// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_text_input.h"

#include <algorithm>
#include <utility>

#include "base/strings/utf_offset_string_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/ime/ime_text_span.h"
#include "ui/base/ime/text_input_flags.h"
#include "ui/base/ime/text_input_mode.h"
#include "ui/base/ime/text_input_type.h"

namespace ui {

namespace {

size_t Clamp(size_t offset, size_t length) {
  return std::min(offset, length);
}

size_t Utf8Boundary(std::string_view text, size_t offset) {
  offset = std::min(offset, text.size());
  while (offset > 0 && offset < text.size() &&
         (static_cast<unsigned char>(text[offset]) & 0xc0) == 0x80) {
    --offset;
  }
  return offset;
}

size_t Utf16Length(std::string_view utf8) {
  return base::UTF8ToUTF16(utf8).size();
}

ImeTextSpan SpanFor(uint8_t style, size_t begin, size_t end) {
  switch (style) {
    case OXYOS_PREEDIT_CONVERTING:
      return ImeTextSpan(ImeTextSpan::Type::kComposition, begin, end,
                         ImeTextSpan::Thickness::kThick);
    case OXYOS_PREEDIT_ERROR: {
      ImeTextSpan span(ImeTextSpan::Type::kComposition, begin, end,
                       ImeTextSpan::Thickness::kThin,
                       ImeTextSpan::UnderlineStyle::kSquiggle);
      span.underline_color = SK_ColorRED;
      return span;
    }
    default:
      return ImeTextSpan(ImeTextSpan::Type::kComposition, begin, end,
                         ImeTextSpan::Thickness::kThin);
  }
}

}

OxyOSFieldText OxyOSFieldTextFrom(const std::u16string& text,
                                  const gfx::Range& text_range,
                                  const gfx::Range& composition_range,
                                  const gfx::Range& selection_range) {
  const size_t origin = text_range.IsValid() ? text_range.GetMin() : 0;
  auto local = [&](size_t offset) {
    return Clamp(offset >= origin ? offset - origin : 0, text.size());
  };
  std::u16string shown = text;
  size_t anchor =
      selection_range.IsValid() ? local(selection_range.start()) : text.size();
  size_t cursor =
      selection_range.IsValid() ? local(selection_range.end()) : text.size();
  if (composition_range.IsValid() && !composition_range.is_empty()) {
    const size_t begin = local(composition_range.GetMin());
    const size_t end = local(composition_range.GetMax());
    shown.erase(begin, end - begin);
    auto without = [&](size_t offset) {
      if (offset >= end) {
        return offset - (end - begin);
      }
      return std::min(offset, begin);
    };
    anchor = without(anchor);
    cursor = without(cursor);
  }
  std::vector<size_t> offsets = {anchor, cursor};
  OxyOSFieldText field;
  field.text = base::UTF16ToUTF8AndAdjustOffsets(shown, &offsets);
  field.anchor = static_cast<uint32_t>(
      offsets[0] == std::u16string::npos ? field.text.size() : offsets[0]);
  field.cursor = static_cast<uint32_t>(
      offsets[1] == std::u16string::npos ? field.text.size() : offsets[1]);
  return field;
}

OxyOSTextPurpose OxyOSTextPurposeOf(
    const LinuxInputMethodContext::TextInputClientAttributes& attributes) {
  OxyOSTextPurpose purpose;
  switch (attributes.input_type) {
    case TEXT_INPUT_TYPE_PASSWORD:
      purpose.purpose = OXYOS_PURPOSE_PASSWORD;
      purpose.hints |= OXYOS_HINT_SENSITIVE;
      break;
    case TEXT_INPUT_TYPE_EMAIL:
      purpose.purpose = OXYOS_PURPOSE_EMAIL;
      break;
    case TEXT_INPUT_TYPE_URL:
      purpose.purpose = OXYOS_PURPOSE_URL;
      break;
    case TEXT_INPUT_TYPE_TELEPHONE:
      purpose.purpose = OXYOS_PURPOSE_PHONE;
      break;
    case TEXT_INPUT_TYPE_NUMBER:
      purpose.purpose = OXYOS_PURPOSE_NUMBER;
      break;
    case TEXT_INPUT_TYPE_DATE:
    case TEXT_INPUT_TYPE_DATE_TIME:
    case TEXT_INPUT_TYPE_DATE_TIME_LOCAL:
    case TEXT_INPUT_TYPE_MONTH:
    case TEXT_INPUT_TYPE_WEEK:
      purpose.purpose = OXYOS_PURPOSE_DATE;
      break;
    case TEXT_INPUT_TYPE_TIME:
      purpose.purpose = OXYOS_PURPOSE_TIME;
      break;
    case TEXT_INPUT_TYPE_TEXT_AREA:
    case TEXT_INPUT_TYPE_CONTENT_EDITABLE:
      purpose.hints |= OXYOS_HINT_MULTILINE;
      break;
    default:
      break;
  }
  if (purpose.purpose == OXYOS_PURPOSE_NORMAL) {
    switch (attributes.input_mode) {
      case TEXT_INPUT_MODE_NUMERIC:
        purpose.purpose = OXYOS_PURPOSE_DIGITS;
        break;
      case TEXT_INPUT_MODE_DECIMAL:
        purpose.purpose = OXYOS_PURPOSE_NUMBER;
        break;
      case TEXT_INPUT_MODE_TEL:
        purpose.purpose = OXYOS_PURPOSE_PHONE;
        break;
      case TEXT_INPUT_MODE_EMAIL:
        purpose.purpose = OXYOS_PURPOSE_EMAIL;
        break;
      case TEXT_INPUT_MODE_URL:
        purpose.purpose = OXYOS_PURPOSE_URL;
        break;
      default:
        break;
    }
  }
  if (attributes.flags &
      (TEXT_INPUT_FLAG_AUTOCOMPLETE_OFF | TEXT_INPUT_FLAG_AUTOCORRECT_OFF |
       TEXT_INPUT_FLAG_SPELLCHECK_OFF)) {
    purpose.hints |= OXYOS_HINT_NO_PREDICTION;
  }
  if (attributes.flags & TEXT_INPUT_FLAG_AUTOCAPITALIZE_NONE) {
    purpose.hints |= OXYOS_HINT_NO_CAPITALIZATION;
  }
  if (!attributes.should_do_learning) {
    purpose.hints |= OXYOS_HINT_SENSITIVE;
  }
  return purpose;
}

OxyOSFieldText OxyOSFieldTextAfter(const OxyOSFieldText& field,
                                   uint32_t delete_before,
                                   uint32_t delete_after,
                                   std::string_view commit) {
  const std::string_view text = field.text;
  const size_t low = Utf8Boundary(text, std::min(field.anchor, field.cursor));
  const size_t high = Utf8Boundary(text, std::max(field.anchor, field.cursor));
  const size_t from =
      Utf8Boundary(text, low - std::min<size_t>(delete_before, low));
  const size_t to = Utf8Boundary(
      text, high + std::min<size_t>(delete_after, text.size() - high));
  OxyOSFieldText after;
  after.text = std::string(text.substr(0, from));
  after.text.append(commit);
  after.anchor = after.cursor = static_cast<uint32_t>(after.text.size());
  after.text.append(text.substr(to));
  return after;
}

OxyOSTextChange::OxyOSTextChange() = default;
OxyOSTextChange::OxyOSTextChange(const OxyOSTextChange&) = default;
OxyOSTextChange& OxyOSTextChange::operator=(const OxyOSTextChange&) = default;
OxyOSTextChange::~OxyOSTextChange() = default;

OxyOSTextChange OxyOSTextChangeFrom(
    const OxyOSFieldText& field,
    uint32_t delete_before,
    uint32_t delete_after,
    std::string_view commit,
    std::string_view preedit,
    uint32_t cursor_begin,
    uint32_t cursor_end,
    const std::vector<OxyOSPreeditSpan>& spans) {
  OxyOSTextChange change;
  const std::string_view text = field.text;
  const size_t low = Utf8Boundary(text, std::min(field.anchor, field.cursor));
  const size_t high = Utf8Boundary(text, std::max(field.anchor, field.cursor));
  if (delete_before) {
    const size_t from =
        Utf8Boundary(text, low - std::min<size_t>(delete_before, low));
    change.delete_before = Utf16Length(text.substr(from, low - from));
  }
  if (delete_after) {
    const size_t to = Utf8Boundary(
        text, high + std::min<size_t>(delete_after, text.size() - high));
    change.delete_after = Utf16Length(text.substr(high, to - high));
  }
  change.commit = base::UTF8ToUTF16(commit);
  if (preedit.empty()) {
    return change;
  }
  std::vector<size_t> offsets = {cursor_begin, cursor_end};
  for (const OxyOSPreeditSpan& span : spans) {
    offsets.push_back(span.begin);
    offsets.push_back(span.end);
  }
  CompositionText composition;
  composition.text = base::UTF8ToUTF16AndAdjustOffsets(preedit, &offsets);
  const size_t length = composition.text.size();
  auto valid = [length](size_t offset) {
    return offset == std::u16string::npos ? length : std::min(offset, length);
  };
  composition.selection = gfx::Range(valid(offsets[0]), valid(offsets[1]));
  for (size_t i = 0; i < spans.size(); ++i) {
    const size_t begin = valid(offsets[2 + 2 * i]);
    const size_t end = valid(offsets[3 + 2 * i]);
    if (begin < end) {
      composition.ime_text_spans.push_back(SpanFor(spans[i].style, begin, end));
    }
  }
  if (composition.ime_text_spans.empty()) {
    composition.ime_text_spans.push_back(
        SpanFor(OXYOS_PREEDIT_COMPOSING, 0, length));
  }
  change.composition = std::move(composition);
  return change;
}

}
