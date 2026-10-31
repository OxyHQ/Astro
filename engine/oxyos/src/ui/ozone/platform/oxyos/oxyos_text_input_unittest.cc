// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_text_input.h"

#include "testing/gtest/include/gtest/gtest.h"
#include "ui/base/ime/ime_text_span.h"
#include "ui/base/ime/text_input_flags.h"
#include "ui/base/ime/text_input_mode.h"
#include "ui/base/ime/text_input_type.h"

namespace ui {

TEST(OxyOSTextInputTest, AFieldIsToldInUtf8BytesWithoutItsComposition) {
  const OxyOSFieldText field =
      OxyOSFieldTextFrom(u"año にほ días", gfx::Range(10, 21),
                         gfx::Range(14, 16), gfx::Range(16, 16));
  EXPECT_EQ(field.text, "año  días");
  EXPECT_EQ(field.anchor, 5u);
  EXPECT_EQ(field.cursor, 5u);
}

TEST(OxyOSTextInputTest, ABackwardSelectionKeepsItsAnchor) {
  const OxyOSFieldText field =
      OxyOSFieldTextFrom(u"€ uno dos", gfx::Range(0, 9),
                         gfx::Range::InvalidRange(), gfx::Range(9, 2));
  EXPECT_EQ(field.text, "€ uno dos");
  EXPECT_EQ(field.anchor, 11u);
  EXPECT_EQ(field.cursor, 4u);
}

TEST(OxyOSTextInputTest, AFieldsPurposeAndHintsComeFromItsAttributes) {
  LinuxInputMethodContext::TextInputClientAttributes attributes;
  attributes.input_type = TEXT_INPUT_TYPE_PASSWORD;
  attributes.should_do_learning = true;
  EXPECT_EQ(OxyOSTextPurposeOf(attributes),
            (OxyOSTextPurpose{OXYOS_PURPOSE_PASSWORD, OXYOS_HINT_SENSITIVE}));
  attributes.input_type = TEXT_INPUT_TYPE_TEXT;
  attributes.input_mode = TEXT_INPUT_MODE_NUMERIC;
  attributes.flags =
      TEXT_INPUT_FLAG_AUTOCORRECT_OFF | TEXT_INPUT_FLAG_AUTOCAPITALIZE_NONE;
  EXPECT_EQ(OxyOSTextPurposeOf(attributes),
            (OxyOSTextPurpose{
                OXYOS_PURPOSE_DIGITS,
                OXYOS_HINT_NO_PREDICTION | OXYOS_HINT_NO_CAPITALIZATION}));
  attributes = {};
  attributes.input_type = TEXT_INPUT_TYPE_CONTENT_EDITABLE;
  attributes.should_do_learning = false;
  EXPECT_EQ(OxyOSTextPurposeOf(attributes),
            (OxyOSTextPurpose{OXYOS_PURPOSE_NORMAL,
                              OXYOS_HINT_MULTILINE | OXYOS_HINT_SENSITIVE}));
  attributes.input_type = TEXT_INPUT_TYPE_URL;
  EXPECT_EQ(OxyOSTextPurposeOf(attributes).purpose, OXYOS_PURPOSE_URL);
}

TEST(OxyOSTextInputTest, ADeletionIsCountedInUtf16AroundTheSelection) {
  OxyOSFieldText field;
  field.text = "añ😀b|cd";
  field.anchor = 8;
  field.cursor = 8;
  const OxyOSTextChange change =
      OxyOSTextChangeFrom(field, 5, 2, "", "", 0, 0, {});
  EXPECT_EQ(change.delete_before, 3u);
  EXPECT_EQ(change.delete_after, 2u);
  EXPECT_FALSE(change.composition);
}

TEST(OxyOSTextInputTest, ADeletionNeverReachesPastTheText) {
  OxyOSFieldText field;
  field.text = "ab";
  field.anchor = 1;
  field.cursor = 1;
  const OxyOSTextChange change =
      OxyOSTextChangeFrom(field, 40, 40, "x", "", 0, 0, {});
  EXPECT_EQ(change.delete_before, 1u);
  EXPECT_EQ(change.delete_after, 1u);
  EXPECT_EQ(change.commit, u"x");
}

TEST(OxyOSTextInputTest, ACompositionHasItsSegmentsAndCursorInUtf16) {
  const OxyOSTextChange change =
      OxyOSTextChangeFrom(OxyOSFieldText(), 0, 0, "", "日本語", 3, 6,
                          {{0, 3, OXYOS_PREEDIT_COMPOSING},
                           {3, 6, OXYOS_PREEDIT_CONVERTING},
                           {6, 9, OXYOS_PREEDIT_ERROR}});
  ASSERT_TRUE(change.composition);
  EXPECT_EQ(change.composition->text, u"日本語");
  EXPECT_EQ(change.composition->selection, gfx::Range(1, 2));
  ASSERT_EQ(change.composition->ime_text_spans.size(), 3u);
  const auto& spans = change.composition->ime_text_spans;
  EXPECT_EQ(spans[0].thickness, ImeTextSpan::Thickness::kThin);
  EXPECT_EQ(spans[1].start_offset, 1u);
  EXPECT_EQ(spans[1].end_offset, 2u);
  EXPECT_EQ(spans[1].thickness, ImeTextSpan::Thickness::kThick);
  EXPECT_EQ(spans[2].underline_style, ImeTextSpan::UnderlineStyle::kSquiggle);
}

TEST(OxyOSTextInputTest, ACompositionWithoutSegmentsIsOneComposingSpan) {
  const OxyOSTextChange change =
      OxyOSTextChangeFrom(OxyOSFieldText(), 0, 0, "", "´", 2, 2, {});
  ASSERT_TRUE(change.composition);
  EXPECT_EQ(change.composition->selection, gfx::Range(1));
  ASSERT_EQ(change.composition->ime_text_spans.size(), 1u);
  EXPECT_EQ(change.composition->ime_text_spans[0].end_offset, 1u);
}

TEST(OxyOSTextInputTest, AnEditIsWhatTheFieldWillHoldBeforeItSaysSo) {
  OxyOSFieldText field;
  field.text = "abc日本xyz";
  field.anchor = 9;
  field.cursor = 9;
  const OxyOSFieldText after = OxyOSFieldTextAfter(field, 3, 1, "é");
  EXPECT_EQ(after.text, "abc日éyz");
  EXPECT_EQ(after.anchor, 8u);
  EXPECT_EQ(after.cursor, 8u);
  field.anchor = 1;
  field.cursor = 3;
  EXPECT_EQ(OxyOSFieldTextAfter(field, 0, 0, "Z").text, "aZ日本xyz");
}

}
