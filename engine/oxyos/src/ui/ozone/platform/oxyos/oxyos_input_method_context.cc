// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_input_method_context.h"

#include <string_view>
#include <vector>

#include "ui/base/ime/text_input_type.h"
#include "ui/ozone/platform/oxyos/oxyos_connection.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"

namespace ui {

OxyOSInputMethodContext::OxyOSInputMethodContext(
    OxyOSConnection* connection,
    LinuxInputMethodContextDelegate* delegate)
    : connection_(connection), delegate_(delegate) {
  connection_->AddInputMethodContext(this);
}

OxyOSInputMethodContext::~OxyOSInputMethodContext() {
  Disable();
  connection_->RemoveInputMethodContext(this);
}

uint32_t OxyOSInputMethodContext::surface() const {
  return static_cast<uint32_t>(delegate_->GetClientWindowKey());
}

void OxyOSInputMethodContext::Send(bool new_field) {
  OxyOSWindow* window = connection_->GetWindow(surface());
  if (!window || !window->shown()) {
    return;
  }
  OxyOSTextField field{};
  field.purpose = purpose_.purpose;
  field.hints = purpose_.hints;
  const bool secret = purpose_.purpose == OXYOS_PURPOSE_PASSWORD;
  if (!secret) {
    field.text = field_.text.data();
    field.length = field_.text.size();
    field.anchor = field_.anchor;
    field.cursor = field_.cursor;
  }
  if (caret_ && !secret) {
    field.has_caret = 1;
    field.caret_x = caret_->x();
    field.caret_y = caret_->y();
    field.caret_width = static_cast<uint32_t>(caret_->width());
    field.caret_height = static_cast<uint32_t>(caret_->height());
  }
  const int64_t serial = oxyos_client_text_input(
      connection_->client(), surface(), &field, new_field ? 1 : 0);
  if (serial > 0) {
    commit_serial_ = static_cast<uint32_t>(serial);
  }
}

void OxyOSInputMethodContext::Disable() {
  if (!enabled_) {
    return;
  }
  enabled_ = false;
  composing_ = false;
  commit_serial_ = 0;
  if (OxyOSWindow* window = connection_->GetWindow(surface());
      window && window->shown()) {
    oxyos_client_text_input(connection_->client(), surface(), nullptr, 0);
  }
}

void OxyOSInputMethodContext::OnTransaction(
    const OxyOSTextTransaction& transaction) {
  if (!enabled_) {
    return;
  }
  std::vector<OxyOSPreeditSpan> spans;
  for (size_t i = 0; i < transaction.segment_count; ++i) {
    const OxyOSPreeditSegment& segment = transaction.segments[i];
    spans.push_back({segment.begin, segment.end, segment.style});
  }
  const bool current = transaction.commit_serial == commit_serial_;
  const OxyOSTextChange change = OxyOSTextChangeFrom(
      field_, current ? transaction.delete_before : 0,
      current ? transaction.delete_after : 0,
      std::string_view(transaction.commit, transaction.commit_length),
      std::string_view(transaction.preedit, transaction.preedit_length),
      transaction.cursor_begin, transaction.cursor_end, spans);
  const bool edits =
      change.delete_before || change.delete_after || !change.commit.empty();
  if (change.delete_before || change.delete_after) {
    delegate_->OnDeleteSurroundingText(change.delete_before,
                                       change.delete_after);
  }
  if (!change.commit.empty()) {
    delegate_->OnCommit(change.commit);
    composing_ = false;
  }
  if (change.composition) {
    if (!composing_) {
      delegate_->OnPreeditStart();
      composing_ = true;
    }
    delegate_->OnPreeditChanged(*change.composition);
  } else if (composing_) {
    composing_ = false;
    delegate_->OnPreeditEnd();
  }
  if (edits) {
    field_ = OxyOSFieldTextAfter(
        field_, current ? transaction.delete_before : 0,
        current ? transaction.delete_after : 0,
        std::string_view(transaction.commit, transaction.commit_length));
    Send(false);
  }
}

bool OxyOSInputMethodContext::DispatchKeyEvent(const KeyEvent& key_event) {
  return false;
}

bool OxyOSInputMethodContext::IsPeekKeyEvent(const KeyEvent& key_event) {
  return false;
}

void OxyOSInputMethodContext::SetCursorLocation(const gfx::Rect& rect) {
  OxyOSWindow* window = connection_->GetWindow(surface());
  if (!window) {
    return;
  }
  const gfx::Rect local = rect - window->GetBoundsInDIP().OffsetFromOrigin();
  if (caret_ == local) {
    return;
  }
  caret_ = local;
  if (enabled_) {
    Send(false);
  }
}

void OxyOSInputMethodContext::SetSurroundingText(
    const std::u16string& text,
    const gfx::Range& text_range,
    const gfx::Range& composition_range,
    const gfx::Range& selection_range) {
  const OxyOSFieldText field =
      OxyOSFieldTextFrom(text, text_range, composition_range, selection_range);
  if (field == field_) {
    return;
  }
  field_ = field;
  if (enabled_) {
    Send(false);
  }
}

void OxyOSInputMethodContext::Reset() {
  if (enabled_) {
    composing_ = false;
    Send(true);
  }
}

void OxyOSInputMethodContext::UpdateFocus(
    bool has_client,
    TextInputType old_type,
    const TextInputClientAttributes& new_client_attributes,
    TextInputClient::FocusReason reason) {
  if (!has_client || new_client_attributes.input_type == TEXT_INPUT_TYPE_NONE) {
    Disable();
    return;
  }
  purpose_ = OxyOSTextPurposeOf(new_client_attributes);
  field_ = OxyOSFieldText();
  caret_.reset();
  composing_ = false;
  enabled_ = true;
  Send(true);
}

VirtualKeyboardController*
OxyOSInputMethodContext::GetVirtualKeyboardController() {
  return nullptr;
}

}
