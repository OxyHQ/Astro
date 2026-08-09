#!/usr/bin/env bash
# A bubble delegate in the Astro overlay must not be handed to CreateBubble by
# value, because nothing on the other side will own it.
#
# The three ways a WidgetDelegate normally gets deleted are all shut to Astro:
#
#   * being a View, so the widget's view hierarchy owns it -- but
#     BubbleDialogDelegateView's constructor is behind a pass key whose friend
#     list says DO NOT ADD TO THIS LIST, so Astro's bubbles derive from the
#     non-View BubbleDialogDelegate;
#   * SetOwnedByWidget(), whose pass key is a closed friend list too;
#   * RegisterDeleteDelegateCallback(), likewise.
#
# So `WidgetDelegate::DeleteDelegate` reaches its `owned_by_widget` branch
# never, and takes the other one: null the delegate's `widget_`, invalidate its
# weak pointers, return. The delegate is still there. Since
# `BubbleDialogDelegate::CreateBubble` takes a std::unique_ptr and immediately
# release()s it, the natural-looking call
#
#     views::BubbleDialogDelegate::CreateBubble(std::move(bubble))->Show();
#
# hands the delegate to nobody, and it outlives its widget with its
# AnchorWidgetObserver still registered on the BrowserWidget. Upstream's
# AnchorWidgetObserver::OnWidgetThemeChanged is `owner_->GetWidget()->
# ThemeChanged()` with no null check, so from then on EVERY theme change on
# that window -- a colour preset, dark mode, a GTK theme change, anything that
# reaches NotifyOnNativeThemeUpdated -- calls a member function on a null
# Widget and takes the browser down.
#
# That is not hypothetical. AstroAdBlockBubbleDelegate shipped in exactly that
# shape: opening the ad blocker bubble once and closing it made the next
# colour-preset change segfault at `views::Widget::ThemeChanged()+14`, with a
# stack that names the theme service and nothing about bubbles. Nine frames of
# it are upstream code. Nothing in a build, a test run or a review of the
# theming change would have pointed at the ad blocker.
#
# What is banned is the CALL SHAPE that gives the delegate away -- passing a
# `std::move`d or freshly `make_unique`d delegate -- rather than any particular
# ownership mode for the Widget. That distinction was learned the hard way:
# CLIENT_OWNS_WIDGET is what upstream recommends and was tried first, and
# tearing the delegate down inside the resulting close callback is a
# use-after-free, because upstream's BubbleWidgetObserver keeps dereferencing
# `owner_` after the call that triggers the close. A rule demanding
# CLIENT_OWNS_WIDGET would therefore have forced the broken shape. Requiring
# only that the caller KEEPS the delegate leaves the lifetime question where
# it belongs and still catches the leak.
#
# A crash needs a running browser; this needs a grep, and it fires on the
# commit that would introduce the next one.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
OVERLAY="$ASTRO_ROOT/src/chrome/browser/oxy"

harness::assert_file_exists \
    "$OVERLAY/adblock/astro_adblock_toolbar_button.cc" \
    "the overlay directory this case scans is where it is expected"

CHECK="$tmp/check.py"
cat > "$CHECK" <<'PY'
"""No CreateBubble call in the given trees may give its delegate away.

argv: one or more directories to scan.
Exit 0 when none does, 1 naming every call that does.

The call is read as a balanced-parenthesis expression rather than a line,
because the real ones wrap across several lines and a line-wise grep would
miss an argument that landed on the next one.
"""

import pathlib
import re
import sys

SOURCE_SUFFIXES = {".cc", ".h", ".mm"}
CALL = "CreateBubble("
# The two ways a delegate leaves the caller's hands. `std::move(x)` hands over
# an existing unique_ptr; `std::make_unique<T>(...)` constructs one nobody ever
# held. Either way CreateBubble release()s it and the object is unowned.
GIVEAWAY = re.compile(r"std::(move|make_unique)\s*[<(]")


def call_expression(text: str, open_paren: int) -> str:
    """The text between `open_paren` and its matching close paren."""
    depth = 0
    for index in range(open_paren, len(text)):
        character = text[index]
        if character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
            if depth == 0:
                return text[open_paren : index + 1]
    # Unbalanced. Hand back the rest of the file rather than silently
    # accepting: a truncated read must not be able to look compliant.
    return text[open_paren:]


def main() -> int:
    roots = [pathlib.Path(argument) for argument in sys.argv[1:]]
    if not roots:
        print("ERROR no directory to scan was given", file=sys.stderr)
        return 1

    violations: list[str] = []
    calls_seen = 0
    files_scanned = 0

    for root in roots:
        if not root.is_dir():
            print(f"ERROR not a directory: {root}", file=sys.stderr)
            return 1
        for path in sorted(root.rglob("*")):
            if path.suffix not in SOURCE_SUFFIXES or not path.is_file():
                continue
            files_scanned += 1
            text = path.read_text(encoding="utf-8", errors="replace")
            position = text.find(CALL)
            while position != -1:
                calls_seen += 1
                open_paren = position + len(CALL) - 1
                expression = call_expression(text, open_paren)
                found = GIVEAWAY.search(expression)
                if found:
                    line = text.count("\n", 0, position) + 1
                    violations.append(
                        f"{path}:{line}: CreateBubble is handed a "
                        f"{found.group(0).rstrip('<(')} delegate"
                    )
                position = text.find(CALL, position + 1)

    # Vacuity floor. A scan that found no call at all is a broken scanner, not
    # a clean tree, and the two must not print the same verdict.
    if calls_seen == 0:
        print(
            f"ERROR scanned {files_scanned} file(s) and found no {CALL} at all; "
            "this check measured nothing",
            file=sys.stderr,
        )
        return 1

    if violations:
        print(
            f"ERROR {len(violations)} bubble delegate(s) given away to CreateBubble:",
            file=sys.stderr,
        )
        for violation in violations:
            print(f"  {violation}", file=sys.stderr)
        print(
            "\nCreateBubble release()s the unique_ptr it is given, and nothing "
            "on the other side deletes it: DeleteDelegate leaves the delegate "
            "alive with its anchor observation still on the BrowserWidget, and "
            "the next theme change dereferences its null widget. Pass the raw "
            "pointer, keep the delegate in a member, and delete it when the "
            "widget goes away -- as AstroAdBlockToolbarButton does.",
            file=sys.stderr,
        )
        return 1

    print(f"OK {calls_seen} CreateBubble call(s) in {files_scanned} file(s), none given away")
    return 0


if __name__ == "__main__":
    sys.exit(main())
PY

# --- The repository as it stands must pass. -------------------------------
harness::run python3 "$CHECK" "$OVERLAY"
harness::assert_status 0 "no bubble in the overlay gives its delegate away"
harness::assert_output_contains "CreateBubble call(s)" \
    "the checker reports how many calls it actually examined"

# --- The negative case: the exact shape that shipped the crash. -----------
# Verbatim the line that was in astro_adblock_bubble_delegate.cc before the
# fix, restored into a copy of the overlay.
mutant="$tmp/mutant"
mkdir -p "$mutant/adblock"
cp "$OVERLAY/adblock/astro_adblock_toolbar_button.cc" "$mutant/adblock/"
python3 - "$mutant/adblock/astro_adblock_toolbar_button.cc" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()
mutated = text.replace(
    "views::Widget* bubble = views::BubbleDialogDelegate::CreateBubble(\n"
    "      bubble_delegate_.get());",
    "views::Widget* bubble =\n"
    "      views::BubbleDialogDelegate::CreateBubble(std::move(bubble_delegate_));",
)
if mutated == text:
    raise SystemExit(
        "FIXTURE STALE: the CreateBubble call this case mutates is no longer "
        "spelled the way it expects, so the negative case below would pass "
        "without testing anything"
    )
path.write_text(mutated)
PY

harness::run python3 "$CHECK" "$mutant"
harness::assert_nonzero_status "a delegate handed over by std::move is refused"
harness::assert_output_contains "astro_adblock_toolbar_button.cc" \
    "the refusal names the file the offending call is in"
harness::assert_output_contains "given away" \
    "the refusal says what is wrong with the call"

# The other giveaway spelling, which is what a fresh bubble written from
# scratch is most likely to use.
mutant2="$tmp/mutant2"
mkdir -p "$mutant2"
cat > "$mutant2/fresh_bubble.cc" <<'EOF'
void ShowIt(views::View* anchor) {
  views::BubbleDialogDelegate::CreateBubble(
      std::make_unique<SomeBubbleDelegate>(anchor))->Show();
}
EOF
harness::run python3 "$CHECK" "$mutant2"
harness::assert_nonzero_status "a delegate constructed inline into CreateBubble is refused"
harness::assert_output_contains "fresh_bubble.cc" \
    "the refusal names the file for the make_unique spelling too"

# --- The vacuity floor must fire, or a broken scan would read as clean. ---
empty="$tmp/empty"
mkdir -p "$empty"
printf 'int main() { return 0; }\n' > "$empty/unrelated.cc"
harness::run python3 "$CHECK" "$empty"
harness::assert_nonzero_status "a scan that finds no CreateBubble at all is refused"
harness::assert_output_contains "measured nothing" \
    "the empty-scan refusal says it measured nothing rather than passing"

harness::pass
