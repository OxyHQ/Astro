import { $n as CrSettingsPrefs, $t as getSearchManager, At as PasswordManagerImpl, C as PrivacyGuideAvailabilityMixin, Cn as MetricsBrowserProxyImpl, Dt as ScrollableMixin, Fn as YourSavedInfoDataCategory, Gn as RestartType, Gt as PrefControlMixin, In as YourSavedInfoDataChip, K as HatsBrowserProxyImpl, Ln as YourSavedInfoRelatedService, Lt as CrPolicyPrefMixin, Mt as I18nMixin$1, Qt as combineSearchResults, Rn as PrefsMixin, S as PrivacyGuideBrowserProxyImpl, Tn as PrivacyGuideInteractions, Wn as RelaunchMixin, Xt as SearchableViewContainerMixin, Y as TrustSafetyInteraction, _ as SearchEnginesBrowserProxyImpl, _n as AiPageInteractions, _t as StatusAction, an as SettingsAiPageFeaturePrefName, d as PaymentsManagerImpl, dt as BaseMixin, f as AutofillManagerImpl, fn as RouteObserverMixin, g as ChoiceMadeLocation, gt as SignedInState, in as ModelExecutionEnterprisePolicyValue, jt as PasswordManagerPage, k as CookieControlsMode, l as resetGlobalScrollTargetForTesting, ln as getTopLevelRoute, lt as TooltipMixin, m as EntityDataManagerProxyImpl, mn as pageVisibility, on as SettingsViewMixin, p as EntityTypeName, pn as Router, pt as ChromeSigninAccessPoint, rn as FeatureOptInState, st as NetworkPredictionOptions, tn as AiEnterpriseFeaturePrefName, tr as Ke, u as setGlobalScrollTarget, un as routes, vt as SyncBrowserProxyImpl, wt as ProfileInfoBrowserProxyImpl, y as ResetBrowserProxyImpl, yn as AutofillSettingsReferrer, zn as loadTimeData$1 } from "./chunk-autofill_ai_entries_list.js";
import "./lazy_load.js";
import "astro://resources/cr_elements/cr_drawer/cr_drawer.js";
import "astro://resources/cr_elements/cr_toolbar/cr_toolbar.js";
import "astro://resources/cr_elements/cr_toolbar/cr_toolbar_search_field.js";
import "astro://resources/cr_elements/cr_page_host_style.css.js";
import "astro://resources/cr_elements/icons.html.js";
import "astro://resources/cr_elements/cr_scrollable.css.js";
import "astro://resources/cr_elements/cr_shared_vars.css.js";
import { PromiseResolver } from "astro://resources/js/promise_resolver.js";
import "astro://resources/cr_components/managed_footnote/managed_footnote.js";
import "astro://resources/cr_elements/cr_shared_style.css.js";
import "astro://resources/cr_elements/cr_view_manager/cr_view_manager.js";
import "astro://resources/cr_elements/cr_button/cr_button.js";
import "astro://resources/cr_elements/cr_dialog/cr_dialog.js";
import { sendWithPromise } from "astro://resources/js/cr.js";
import { assert, assertNotReached, assertNotReachedCase } from "astro://resources/js/assert.js";
import { PolymerElement, afterNextRender, beforeNextRender, dedupingMixin, flush } from "astro://resources/polymer/v3_0/polymer/polymer_bundled.min.js";
import "astro://resources/cr_elements/cr_icon_button/cr_icon_button.js";
import "astro://resources/cr_elements/cr_icon/cr_icon.js";
import "astro://resources/cr_elements/cr_link_row/cr_link_row.js";
import { I18nMixin } from "astro://resources/cr_elements/i18n_mixin.js";
import { WebUiListenerMixin } from "astro://resources/cr_elements/web_ui_listener_mixin.js";
import { sanitizeInnerHtml } from "astro://resources/js/parse_html_subset.js";
import { loadTimeData } from "astro://resources/js/load_time_data.js";
import { OpenWindowProxyImpl } from "astro://resources/js/open_window_proxy.js";
import "astro://resources/cr_components/managed_dialog/managed_dialog.js";
import "astro://resources/cr_elements/md_select.css.js";
import "astro://resources/cr_elements/cr_input/cr_input.js";
import { CustomizeColorSchemeModeBrowserProxy } from "astro://resources/cr_components/customize_color_scheme_mode/browser_proxy.js";
import { ColorSchemeMode } from "astro://resources/cr_components/customize_color_scheme_mode/customize_color_scheme_mode.mojom-webui.js";
import "astro://resources/js/action_link.js";
import "astro://resources/cr_elements/action_link.css.js";
import "astro://resources/polymer/v3_0/iron-list/iron-list.js";
import "astro://resources/cr_elements/cr_action_menu/cr_action_menu.js";
import "astro://resources/cr_elements/cr_lazy_render/cr_lazy_render.js";
import { getImage } from "astro://resources/js/icon.js";
import { FocusRowMixin } from "astro://resources/cr_elements/focus_row_mixin.js";
import { focusWithoutInk } from "astro://resources/js/focus_without_ink.js";
import "astro://resources/cr_elements/cr_toast/cr_toast.js";
import "astro://resources/cr_elements/policy/cr_policy_indicator.js";
import { isChromeOS } from "astro://resources/js/platform.js";
import "astro://resources/cr_elements/cr_collapse/cr_collapse.js";
import "astro://resources/cr_elements/cr_expand_button/cr_expand_button.js";
import "astro://resources/cr_elements/cr_tooltip/cr_tooltip.js";
import { ListPropertyUpdateMixin } from "astro://resources/cr_elements/list_property_update_mixin.js";
import "astro://resources/cr_elements/cr_page_selector/cr_page_selector.js";
import { NONE_SELECTED } from "astro://resources/cr_elements/cr_tabs/cr_tabs.js";
import "astro://resources/cr_elements/cr_checkbox/cr_checkbox.js";
import { HelpBubbleMixin } from "astro://resources/cr_components/help_bubble/help_bubble_mixin.js";
import "astro://resources/cr_elements/cr_radio_button/cr_radio_button.js";
import "astro://resources/cr_elements/cr_radio_group/cr_radio_group.js";
import "astro://resources/cr_elements/cr_chip/cr_chip.js";
import { getInstance } from "astro://resources/cr_elements/cr_a11y_announcer/cr_a11y_announcer.js";
import { getTrustedScriptURL } from "astro://resources/js/static_types.js";
import "astro://resources/cr_elements/cr_icons.css.js";
import "astro://resources/cr_elements/cr_menu_selector/cr_menu_selector.js";
import "astro://resources/cr_elements/cr_hidden_style.css.js";
import "astro://resources/cr_elements/cr_nav_menu_item_style.css.js";
import "astro://resources/cr_elements/cr_ripple/cr_ripple.js";
import { FindShortcutMixin } from "astro://resources/cr_elements/find_shortcut_mixin.js";
import { listenOnce } from "astro://resources/js/util.js";
import "astro://resources/cr_elements/cr_toggle/cr_toggle.js";
import "astro://resources/js/plural_string_proxy.js";
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/about_page/about_page.html.js
function getTemplate$41() {
	return Ke`<!--_html_template_start_-->    <style include="cr-shared-style settings-shared">:host{--about-page-image-space:10px}.info-sections{padding:var(--cr-section-vertical-padding) var(--cr-section-padding)}.info-section{margin-bottom:12px}.product-title{font-size:153.85%;font-weight:400;margin-bottom:auto;margin-top:auto}#product-logo{margin-inline-end:var(--about-page-image-space)}.icon-container{margin-inline-end:var(--about-page-image-space);min-width:32px;text-align:center}cr-icon[icon='cr:check-circle']{fill:var(--cr-checked-color)}cr-icon[icon='cr:error']{fill:var(--settings-error-color)}#throbber{height:var(--cr-icon-size);vertical-align:middle}cr-button{white-space:nowrap}
    </style>
    <settings-section page-title="$i18n{aboutPageTitle}">
      <div class="cr-row two-line first">
        <img id="product-logo" on-click="onProductLogoClick_"
            srcset="astro://theme/current-channel-logo@1x 1x,
                    astro://theme/current-channel-logo@2x 2x"
            alt="$i18n{aboutProductLogoAlt}"
            role="presentation">
        <div class="product-title">$i18n{aboutProductTitle}</div>
      </div>
      <div class="cr-row two-line">
        <!-- Set the icon from the iconset (when it's obsolete/EOL and
          when update is done) or set the src (when it's updating). -->

        <div class="flex cr-padded-text">

          <div class="secondary">$i18n{aboutBrowserVersion}</div>
        </div>

        <div class="separator" hidden="[[!showButtonContainer_]]"></div>
        <span id="buttonContainer" hidden="[[!showButtonContainer_]]">
          <cr-button id="relaunch" hidden="[[!showRelaunch_]]"
              on-click="onRelaunchClick_">
            $i18n{aboutRelaunch}
          </cr-button>
        </span>

      </div>


      <cr-link-row class="hr" on-click="onManagementPageClick_"
          start-icon="[[managedByIcon_]]" label="$i18n{managementPage}"
          role-description="$i18n{subpageArrowRoleDescription}"
          hidden$="[[!isManaged_]]"></cr-link-row>
    </settings-section>

    <settings-section>
      <div class="info-sections">
        <div class="info-section">
          <div class="secondary">$i18n{aboutProductTitle}</div>
          <div class="secondary">$i18n{aboutProductCopyright}</div>
        </div>

        <div class="info-section">
          <div class="secondary">$i18nRaw{aboutProductLicense}</div>
        </div>


  <template is="dom-if" if="[[shouldShowRelaunchDialog]]" restamp>
    <relaunch-confirmation-dialog restart-type="[[restartTypeEnum.RELAUNCH]]"
        on-close="onRelaunchDialogClose"></relaunch-confirmation-dialog>
  </template>

      </div>
    </settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/about_page/about_page_browser_proxy.js
/**
* @fileoverview A helper object used from the "About" section to interact with
* the browser.
*/
/**
* Enumeration of all possible update statuses. The string literals must match
* the ones defined at |AboutHandler::UpdateStatusToString|.
* @enum {string}
*/
var UpdateStatus;
(function(UpdateStatus) {
	UpdateStatus["CHECKING"] = "checking";
	UpdateStatus["UPDATING"] = "updating";
	UpdateStatus["NEARLY_UPDATED"] = "nearly_updated";
	UpdateStatus["UPDATED"] = "updated";
	UpdateStatus["FAILED"] = "failed";
	UpdateStatus["FAILED_HTTP"] = "failed_http";
	UpdateStatus["FAILED_DOWNLOAD"] = "failed_download";
	UpdateStatus["DISABLED"] = "disabled";
	UpdateStatus["DISABLED_BY_ADMIN"] = "disabled_by_admin";
	UpdateStatus["NEED_PERMISSION_TO_UPDATE"] = "need_permission_to_update";
})(UpdateStatus || (UpdateStatus = {}));
var AboutPageBrowserProxyImpl = class AboutPageBrowserProxyImpl {
	pageReady() {
		chrome.send("aboutPageReady");
	}
	refreshUpdateStatus() {
		chrome.send("refreshUpdateStatus");
	}
	openHelpPage() {
		chrome.send("openHelpPage");
	}
	static getInstance() {
		return instance$7 || (instance$7 = new AboutPageBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$7 = obj;
	}
};
var instance$7 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/about_page/about_page.js
var SettingsAboutPageElementBase = RelaunchMixin(WebUiListenerMixin(I18nMixin(PolymerElement)));
var SettingsAboutPageElement = class extends SettingsAboutPageElementBase {
	static get is() {
		return "settings-about-page";
	}
	static get template() {
		return getTemplate$41();
	}
	static get properties() {
		return {
			currentUpdateStatusEvent_: {
				type: Object,
				value: {
					message: "",
					progress: 0,
					rollback: false,
					status: UpdateStatus.DISABLED
				}
			},
			/**
			* Whether the browser/ChromeOS is managed by their organization
			* through enterprise policies.
			*/
			isManaged_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("isManaged");
				}
			},
			/**
			* The name of the icon to display in the management card.
			* Should only be read if isManaged_ is true.
			*/
			managedByIcon_: {
				type: String,
				value() {
					return loadTimeData$1.getString("managedByIcon");
				}
			},
			obsoleteSystemInfo_: {
				type: Object,
				value() {
					return {
						obsolete: loadTimeData$1.getBoolean("aboutObsoleteNowOrSoon"),
						endOfLine: loadTimeData$1.getBoolean("aboutObsoleteEndOfTheLine")
					};
				}
			},
			showUpdateStatus_: {
				type: Boolean,
				value: false
			},
			showButtonContainer_: Boolean,
			showRelaunch_: {
				type: Boolean,
				value: false
			}
		};
	}
	static get observers() {
		return [
			"updateShowUpdateStatus_(obsoleteSystemInfo_, currentUpdateStatusEvent_)",
			"updateShowRelaunch_(currentUpdateStatusEvent_)",
			"updateShowButtonContainer_(showRelaunch_)"
		];
	}
	aboutBrowserProxy_ = AboutPageBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		this.aboutBrowserProxy_.pageReady();
		this.startListening_();
	}
	getPromoteUpdaterClass_() {
		return "";
	}
	startListening_() {
		this.addWebUiListener("update-status-changed", this.onUpdateStatusChanged_.bind(this));
		this.aboutBrowserProxy_.refreshUpdateStatus();
	}
	onUpdateStatusChanged_(event) {
		this.currentUpdateStatusEvent_ = event;
	}
	onLearnMoreClick_(event) {
		event.stopPropagation();
	}
	onHelpClick_() {
		this.aboutBrowserProxy_.openHelpPage();
	}
	onRelaunchClick_() {
		this.performRestart(RestartType.RELAUNCH);
	}
	updateShowUpdateStatus_() {
		if (this.obsoleteSystemInfo_.endOfLine) {
			this.showUpdateStatus_ = false;
			return;
		}
		this.showUpdateStatus_ = this.currentUpdateStatusEvent_.status !== UpdateStatus.DISABLED;
	}
	/**
	* Hide the button container if all buttons are hidden, otherwise the
	* container displays an unwanted border (see separator class).
	*/
	updateShowButtonContainer_() {
		this.showButtonContainer_ = this.showRelaunch_;
	}
	updateShowRelaunch_() {
		this.showRelaunch_ = this.checkStatus_(UpdateStatus.NEARLY_UPDATED);
	}
	shouldShowLearnMoreLink_() {
		return this.currentUpdateStatusEvent_.status === UpdateStatus.FAILED;
	}
	getUpdateStatusMessage_() {
		switch (this.currentUpdateStatusEvent_.status) {
			case UpdateStatus.CHECKING:
			case UpdateStatus.NEED_PERMISSION_TO_UPDATE: return this.i18nAdvanced("aboutUpgradeCheckStarted");
			case UpdateStatus.NEARLY_UPDATED: return this.i18nAdvanced("aboutUpgradeRelaunch");
			case UpdateStatus.UPDATED: return this.i18nAdvanced("aboutUpgradeUpToDate");
			case UpdateStatus.UPDATING:
				assert(typeof this.currentUpdateStatusEvent_.progress === "number");
				const progressPercent = this.currentUpdateStatusEvent_.progress + "%";
				if (this.currentUpdateStatusEvent_.progress > 0) return this.i18nAdvanced("aboutUpgradeUpdatingPercent", { substitutions: [progressPercent] });
				return this.i18nAdvanced("aboutUpgradeUpdating");
			default:
				let result = "";
				const message = this.currentUpdateStatusEvent_.message;
				if (message) result += message;
				const connectMessage = this.currentUpdateStatusEvent_.connectionTypes;
				if (connectMessage) result += `<div>${connectMessage}</div>`;
				return sanitizeInnerHtml(result, { tags: ["br", "pre"] });
		}
	}
	getUpdateStatusIcon_() {
		if (this.obsoleteSystemInfo_.endOfLine) return "cr:error";
		switch (this.currentUpdateStatusEvent_.status) {
			case UpdateStatus.DISABLED_BY_ADMIN: return "cr20:domain";
			case UpdateStatus.FAILED: return "cr:error";
			case UpdateStatus.UPDATED:
			case UpdateStatus.NEARLY_UPDATED: return "cr:check-circle";
			default: return "";
		}
	}
	shouldShowThrobber_() {
		if (this.obsoleteSystemInfo_.endOfLine) return false;
		switch (this.currentUpdateStatusEvent_.status) {
			case UpdateStatus.CHECKING:
			case UpdateStatus.UPDATING: return true;
			default: return false;
		}
	}
	checkStatus_(status) {
		return this.currentUpdateStatusEvent_.status === status;
	}
	onManagementPageClick_() {
		window.location.href = loadTimeData$1.getString("managementPageUrl");
	}
	onProductLogoClick_() {
		this.$["product-logo"].animate({ transform: ["none", "rotate(-10turn)"] }, {
			duration: 500,
			easing: "cubic-bezier(1, 0, 0, 1)"
		});
	}
	shouldShowIcons_() {
		if (this.obsoleteSystemInfo_.endOfLine) return true;
		return this.showUpdateStatus_;
	}
	searchContents(query) {
		return Promise.resolve({
			canceled: false,
			matchCount: 0,
			wasClearSearch: query === ""
		});
	}
};
customElements.define(SettingsAboutPageElement.is, SettingsAboutPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_info_card.html.js
function getTemplate$40() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared settings-columned-section">:host{--cr-icon-size:16px;--info-card-background-color:var(--google-blue-50)}@media (prefers-color-scheme:dark){:host{--info-card-background-color:var(--google-grey-800)}}.settings-columned-section{background-color:var(--info-card-background-color)}.title{color:var(--cr-primary-text-color);font-size:1rem;font-weight:500;letter-spacing:.25px}.settings-columned-section h3.description-header{color:var(--cr-primary-text-color);font-weight:500}.icon-bulleted-list li{margin:8px 0}settings-section{--cr-card-shadow:none}@media (forced-colors:active){settings-section{--cr-border-hcm:none}}</style>

<settings-section>
<div class="settings-columned-section">
  <div class="column">
    <h2 class="title first">$i18n{aiPageMainTitle}</h2>
    <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
    <ul class="icon-bulleted-list">
      <li>
        <cr-icon icon="settings20:psychiatry" aria-hidden="true"></cr-icon>
        <div class="secondary">$i18n{aiPageMainSublabel1}</div>
      </li>
      <li>
        <cr-icon icon="settings20:googleg" aria-hidden="true"></cr-icon>
        <div class="secondary">$i18n{aiPageMainSublabel2}</div>
      </li>
      <li>
        <cr-icon icon="[[icon3_]]" aria-hidden="true"></cr-icon>
        <div class="secondary">
        <template is="dom-if" if="[[!isManaged_()]]" restamp>
          $i18n{aiPageMainSublabel3}
        </template>
        <template is="dom-if" if="[[isManaged_()]]" restamp>
          $i18n{aiPageMainManagedSublabel3}
          <a href="$i18n{aiPageMainManagedLearnMoreUrl}"
              aria-label="$i18n{aiPageMainManagedLearnMoreAccessibiltyLabel}"
              aria-description="$i18n{opensInNewTab}"
              target="_blank">
            $i18n{learnMore}
          </a>
        </template>
        </div>
      </li>
    </ul>
  </div>
</div>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_info_card.js
var SettingsAiInfoCardElement = class extends PolymerElement {
	static get is() {
		return "settings-ai-info-card";
	}
	static get template() {
		return getTemplate$40();
	}
	static get properties() {
		return { icon3_: {
			type: String,
			computed: "computeIcon3_()"
		} };
	}
	isManaged_() {
		return loadTimeData$1.getBoolean("isManaged");
	}
	computeIcon3_() {
		return this.isManaged_() ? loadTimeData$1.getString("managedByIcon") : "settings20:account-box";
	}
};
customElements.define(SettingsAiInfoCardElement.is, SettingsAiInfoCardElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_page.html.js
function getTemplate$39() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared"></style>

<!-- TODO(crbug.com/362225975): Remove V2 suffixes. -->
<settings-section page-title="$i18n{aiInnovationsPageTitle}">
  <div>
    <cr-link-row id="passwordChangeRowV2" class="hr"
        hidden="[[!showPasswordChangeControl_]]"
        start-icon="cr20:password"
        label="$i18n{passwordChangeSettingLabel}"
        sub-label="$i18n{passwordChangeSettingSubLabel}"
        on-click="onPasswordChangeRowClick_" external>
    </cr-link-row>
    <cr-link-row id="historySearchRowV2" class="hr"
        hidden="[[!showHistorySearchControl_]]"
        start-icon="settings20:search-spark"
        label="$i18n{historySearchSettingLabel}"
        sub-label="[[getHistorySearchSublabel_(
          prefs.optimization_guide.history_search_setting_state.value)]]"
        role-description="$i18n{subpageArrowRoleDescription}"
        on-click="onHistorySearchRowClick_">
    </cr-link-row>
    <cr-link-row id="composeRowV2" class="hr"
        hidden="[[!showComposeControl_]]"
        start-icon="settings20:pen-spark"
        label="$i18n{aiComposeLabel}"
        sub-label="$i18n{aiComposeSublabelV2}"
        role-description="$i18n{subpageArrowRoleDescription}"
        on-click="onComposeRowClick_">
    </cr-link-row>
    <cr-link-row id="tabOrganizationRowV2" class="hr"
        hidden="[[!showTabOrganizationControl_]]"
        start-icon="settings20:auto-tab-group"
        label="$i18n{tabOrganizationSettingLabel}"
        sub-label="$i18n{tabOrganizationSettingSublabelV2}"
        role-description="$i18n{subpageArrowRoleDescription}"
        on-click="onTabOrganizationRowClick_">
    </cr-link-row>
  </div>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_page.js
var SettingsAiPageElementBase = SettingsViewMixin(PrefsMixin(PolymerElement));
var SettingsAiPageElement = class extends SettingsAiPageElementBase {
	static get is() {
		return "settings-ai-page";
	}
	static get template() {
		return getTemplate$39();
	}
	static get properties() {
		return {
			showComposeControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showComposeControl")
			},
			showHistorySearchControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showHistorySearchControl")
			},
			showTabOrganizationControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showTabOrganizationControl")
			},
			showPasswordChangeControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showPasswordChangeControl")
			}
		};
	}
	shouldRecordMetrics_ = true;
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		this.maybeLogVisibilityMetrics_();
	}
	maybeLogVisibilityMetrics_() {
		if (!this.shouldRecordMetrics_ || Router.getInstance().getCurrentRoute() !== routes.AI) return;
		this.shouldRecordMetrics_ = false;
		this.metricsBrowserProxy_.recordBooleanHistogram("Settings.AiPage.ElementVisibility.HistorySearch", this.showHistorySearchControl_);
		this.metricsBrowserProxy_.recordBooleanHistogram("Settings.AiPage.ElementVisibility.Compose", this.showComposeControl_);
		this.metricsBrowserProxy_.recordBooleanHistogram("Settings.AiPage.ElementVisibility.TabOrganization", this.showTabOrganizationControl_);
		this.metricsBrowserProxy_.recordBooleanHistogram("Settings.AiPage.ElementVisibility.PasswordChange", this.showPasswordChangeControl_);
	}
	onHistorySearchRowClick_() {
		this.recordInteractionMetrics_(AiPageInteractions.HISTORY_SEARCH_CLICK, "Settings.AiPage.HistorySearchEntryPointClick");
		const router = Router.getInstance();
		router.navigateTo(router.getRoutes().HISTORY_SEARCH);
	}
	onComposeRowClick_() {
		this.recordInteractionMetrics_(AiPageInteractions.COMPOSE_CLICK, "Settings.AiPage.ComposeEntryPointClick");
		const router = Router.getInstance();
		router.navigateTo(router.getRoutes().OFFER_WRITING_HELP);
	}
	onTabOrganizationRowClick_() {
		this.recordInteractionMetrics_(AiPageInteractions.TAB_ORGANIZATION_CLICK, "Settings.AiPage.TabOrganizationEntryPointClick");
		const router = Router.getInstance();
		router.navigateTo(router.getRoutes().AI_TAB_ORGANIZATION);
	}
	onPasswordChangeRowClick_() {
		this.recordInteractionMetrics_(AiPageInteractions.PASSWORD_CHANGE_CLICK, "Settings.AiPage.PasswordChangeEntryPointClick");
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("passwordChangeSettingsUrl"));
	}
	recordInteractionMetrics_(interaction, action) {
		this.metricsBrowserProxy_.recordAiPageInteractions(interaction);
		this.metricsBrowserProxy_.recordAction(action);
	}
	getHistorySearchSublabel_() {
		const isAnswersEnabled = loadTimeData$1.getBoolean("historyEmbeddingsAnswersFeatureEnabled");
		if (this.getPref(SettingsAiPageFeaturePrefName.HISTORY_SEARCH).value === FeatureOptInState.ENABLED) return isAnswersEnabled ? loadTimeData$1.getString("historySearchWithAnswersSublabelOn") : loadTimeData$1.getString("historySearchSublabelOn");
		return isAnswersEnabled ? loadTimeData$1.getString("historySearchWithAnswersSublabelOff") : loadTimeData$1.getString("historySearchSublabelOff");
	}
	getFocusConfig() {
		const map = /* @__PURE__ */ new Map();
		if (routes.HISTORY_SEARCH) map.set(routes.HISTORY_SEARCH.path, "#historySearchRowV2");
		if (routes.OFFER_WRITING_HELP) map.set(routes.OFFER_WRITING_HELP.path, "#composeRowV2");
		if (routes.AI_TAB_ORGANIZATION) map.set(routes.AI_TAB_ORGANIZATION.path, "#tabOrganizationRowV2");
		return map;
	}
	getAssociatedControlFor(childViewId) {
		assert([
			"compose",
			"historySearch",
			"tabOrganization"
		].includes(childViewId));
		let triggerId = null;
		switch (childViewId) {
			case "compose":
				assert(this.showComposeControl_);
				triggerId = "composeRowV2";
				break;
			case "historySearch":
				assert(this.showHistorySearchControl_);
				triggerId = "historySearchRowV2";
				break;
			case "tabOrganization":
				assert(this.showTabOrganizationControl_);
				triggerId = "tabOrganizationRowV2";
				break;
			default: assertNotReached();
		}
		assert(triggerId);
		const control = this.shadowRoot.querySelector(`#${triggerId}`);
		assert(control);
		return control;
	}
};
customElements.define(SettingsAiPageElement.is, SettingsAiPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_page_index.html.js
function getTemplate$38() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}cr-view-manager [slot=view]:not(.closing){position:initial}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">
  <settings-ai-info-card slot="view" id="aiInfoCard"></settings-ai-info-card>



  <template is="dom-if" if="[[showAiPageAiFeatureSection_]]">
    <settings-ai-page slot="view" id="parent" prefs="{{prefs}}">
    </settings-ai-page>
  </template>

  <template is="dom-if" if="[[showHistorySearchControl_]]">
    <settings-history-search-page slot="view" id="historySearch"
        data-parent-view-id="parent" prefs="{{prefs}}"
        route-path$="[[routes_.HISTORY_SEARCH.path]]">
    </settings-history-search-page>
  </template>

  <template is="dom-if" if="[[showComposeControl_]]">
    <settings-offer-writing-help-page slot="view" id="compose"
        data-parent-view-id="parent" prefs="{{prefs}}"
        route-path$="[[routes_.OFFER_WRITING_HELP.path]]">
    </settings-offer-writing-help-page>
  </template>

  <template is="dom-if" if="[[showTabOrganizationControl_]]">
    <settings-ai-tab-organization-subpage slot="view" id="tabOrganization"
        data-parent-view-id="parent" prefs="{{prefs}}"
        route-path$="[[routes_.AI_TAB_ORGANIZATION.path]]">
    </settings-ai-tab-organization-subpage>
  </template>
</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_page_index.js
var SettingsAiPageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(PolymerElement));
var SettingsAiPageIndexElement = class extends SettingsAiPageIndexElementBase {
	static get is() {
		return "settings-ai-page-index";
	}
	static get template() {
		return getTemplate$38();
	}
	static get properties() {
		return {
			prefs: Object,
			routes_: {
				type: Object,
				value: () => routes
			},
			showAiPageAiFeatureSection_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showAiPageAiFeatureSection")
			},
			showComposeControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showComposeControl")
			},
			showHistorySearchControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showHistorySearchControl")
			},
			showTabOrganizationControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showTabOrganizationControl")
			}
		};
	}
	showDefaultViews_() {
		const defaultViews = ["aiInfoCard"];
		if (this.showAiPageAiFeatureSection_) defaultViews.push("parent");
		this.$.viewManager.switchViews(defaultViews, "no-animation", "no-animation");
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.AI:
					this.showDefaultViews_();
					break;
				case routes.BASIC:
					this.showDefaultViews_();
					break;
				case routes.AI_TAB_ORGANIZATION:
					assert(this.showTabOrganizationControl_);
					this.$.viewManager.switchView("tabOrganization", "no-animation", "no-animation");
					break;
				case routes.HISTORY_SEARCH:
					assert(this.showHistorySearchControl_);
					this.$.viewManager.switchView("historySearch", "no-animation", "no-animation");
					break;
				case routes.OFFER_WRITING_HELP:
					assert(this.showComposeControl_);
					this.$.viewManager.switchView("compose", "no-animation", "no-animation");
			}
		});
	}
};
customElements.define(SettingsAiPageIndexElement.is, SettingsAiPageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/appearance_browser_proxy.js
var AppearanceBrowserProxyImpl = class AppearanceBrowserProxyImpl {
	getDefaultZoom() {
		return chrome.settingsPrivate.getDefaultZoom();
	}
	getThemeInfo(themeId) {
		return chrome.management.get(themeId);
	}
	isChildAccount() {
		return loadTimeData$1.getBoolean("isChildAccount");
	}
	openCustomizeChrome() {
		chrome.send("openCustomizeChrome");
	}
	openCustomizeChromeToolbarSection() {
		chrome.send("openCustomizeChromeToolbarSection");
	}
	recordHoverCardImagesEnabledChanged(enabled) {
		chrome.metricsPrivate.recordBoolean("Settings.HoverCards.ImagePreview.Enabled", enabled);
	}
	resetPinnedToolbarActions() {
		chrome.send("resetPinnedToolbarActions");
	}
	useDefaultTheme() {
		chrome.send("useDefaultTheme");
	}
	useGtkTheme() {
		chrome.send("useGtkTheme");
	}
	useQtTheme() {
		chrome.send("useQtTheme");
	}
	validateStartupPage(url) {
		return sendWithPromise("validateStartupPage", url);
	}
	pinnedToolbarActionsAreDefault() {
		return sendWithPromise("pinnedToolbarActionsAreDefault");
	}
	static getInstance() {
		return instance$6 || (instance$6 = new AppearanceBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$6 = obj;
	}
};
var instance$6 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/home_url_input.html.js
function getTemplate$37() {
	return Ke`<!--_html_template_start_-->    <style>:host{cursor:auto;display:block;width:100%}cr-input{width:100%;--cr-input-width:50%}cr-input::part(row-container){justify-content:normal}
    </style>
    <!-- Max length of 100 KB to prevent browser from freezing. -->
    <cr-input id="input" value="{{value}}" error-message="$i18n{notValid}"
        placeholder="$i18n{enterCustomWebAddress}" maxlength="102400"
        on-change="onChange_" on-keydown="onKeydown_" on-input="validate_"
        invalid="{{invalid}}" input-tabindex="[[getTabindex_(canTab)]]"
        disabled="[[isDisabled_(disabled, pref.*)]]" spellcheck="false"
        on-keyup="stopKeyEventPropagation_"
        on-keypress="stopKeyEventPropagation_">
      <template is="dom-if" if="[[hasPrefPolicyIndicator(pref.*)]]">
        <cr-policy-pref-indicator pref="[[pref]]" icon-aria-label="[[label]]"
            slot="suffix">
        </cr-policy-pref-indicator>
      </template>
    </cr-input>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/home_url_input.js
var HomeUrlInputElementBase = CrPolicyPrefMixin(PrefControlMixin(PolymerElement));
var HomeUrlInputElement = class extends HomeUrlInputElementBase {
	static get is() {
		return "home-url-input";
	}
	static get template() {
		return getTemplate$37();
	}
	static get properties() {
		return {
			/**
			* The preference object to control.
			*/
			pref: { observer: "prefChanged_" },
			disabled: {
				type: Boolean,
				value: false,
				reflectToAttribute: true
			},
			canTab: Boolean,
			invalid: {
				type: Boolean,
				value: false
			},
			value: {
				type: String,
				value: "",
				notify: true
			}
		};
	}
	browserProxy_ = AppearanceBrowserProxyImpl.getInstance();
	constructor() {
		super();
		this.noExtensionIndicator = true;
	}
	/**
	* Focuses the 'input' element.
	*/
	focus() {
		this.$.input.focus();
	}
	/**
	* Polymer changed observer for |pref|.
	*/
	prefChanged_() {
		if (!this.pref) return;
		this.setInputValueFromPref_();
	}
	setInputValueFromPref_() {
		assert(this.pref.type === chrome.settingsPrivate.PrefType.URL);
		this.value = this.pref.value;
	}
	/**
	* Gets a tab index for this control if it can be tabbed to.
	*/
	getTabindex_(canTab) {
		return canTab ? 0 : -1;
	}
	/**
	* Change event handler for cr-input. Updates the pref value.
	* settings-input uses the change event because it is fired by the Enter key.
	*/
	onChange_() {
		if (this.invalid) {
			this.resetValue_();
			return;
		}
		assert(this.pref.type === chrome.settingsPrivate.PrefType.URL);
		this.set("pref.value", this.value);
	}
	resetValue_() {
		this.invalid = false;
		this.setInputValueFromPref_();
		this.$.input.blur();
	}
	/**
	* Keydown handler to specify enter-key and escape-key interactions.
	*/
	onKeydown_(event) {
		if (event.key === "Enter" && this.invalid) event.preventDefault();
		else if (event.key === "Escape") this.resetValue_();
		this.stopKeyEventPropagation_(event);
	}
	/**
	* This function prevents unwanted change of selection of the containing
	* cr-radio-group, when the user traverses the input with arrow keys.
	*/
	stopKeyEventPropagation_(e) {
		e.stopPropagation();
	}
	/** @return Whether the element should be disabled. */
	isDisabled_(disabled) {
		return disabled || this.isPrefEnforced();
	}
	validate_() {
		if (this.value === "") {
			this.invalid = false;
			return;
		}
		this.browserProxy_.validateStartupPage(this.value).then((isValid) => {
			this.invalid = !isValid;
		});
	}
};
customElements.define(HomeUrlInputElement.is, HomeUrlInputElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/appearance_page.html.js
function getTemplate$36() {
	return Ke`<!--_html_template_start_-->    <style include="cr-shared-style settings-shared md-select">#custom-input{--cr-radio-button-disc-margin-block-start:calc((1.54em + 12px) / 2 - 8px);align-items:start}#themeRow cr-button,#toolbarRow cr-button{margin-inline-end:20px}#themeRow .separator,#toolbarRow .separator{margin-inline-start:0}#toolbarRow{border-top:var(--cr-separator-line)}.hover-card-toggles{padding-inline-end:0}.hover-card-toggles settings-toggle-button{padding-inline-start:0}#tabSearchPositionRestart{margin-inline-end:20px}

    </style>
    <settings-section page-title="$i18n{appearancePageTitle}">
      <div route-path="default">
        <div class="cr-row first" id="themeRow"
            hidden="[[!pageVisibility.setTheme]]">
          <div class="flex cr-padded-text">
            <div>$i18n{themes}</div><div class="secondary">[[themeSublabel_]]</div>
          </div>


          <div class="settings-row continuation"
              hidden="[[!showThemesSecondary_(
                  prefs.extensions.theme.id.value, systemTheme_)]]"
              id="themesSecondaryActions">
            <div class="separator"></div>
            <template is="dom-if" if="[[showUseClassic_(
                prefs.extensions.theme.id.value, systemTheme_)]]" restamp>
              <cr-button id="useDefault" on-click="onUseDefaultClick_">
                $i18n{useClassicTheme}
              </cr-button>
            </template>
            <template is="dom-if" if="[[showUseGtk_(
                prefs.extensions.theme.id.value, systemTheme_)]]" restamp>
              <cr-button id="useGtk" on-click="onUseGtkClick_">
                $i18n{useGtkTheme}
              </cr-button>
            </template>
            <template is="dom-if" if="[[showUseQt_(
                prefs.extensions.theme.id.value, systemTheme_)]]" restamp>
              <cr-button id="useQt" on-click="onUseQtClick_">
                $i18n{useQtTheme}
              </cr-button>
            </template>
          </div>

        </div>
        <div id="toolbarRow" class="settings-row">
          <cr-link-row id="customizeToolbar"
              label="$i18n{customizeToolbar}"
              on-click="onCustomizeToolbarClick_" external>
          </cr-link-row>
          <template is="dom-if" if="[[showResetPinnedActionsButton_]]">
            <div class="separator"></div>
            <cr-button id="resetPinnedToolbarActions"
                on-click="onResetPinnedToolbarActionsClick_"
                aria-label="$i18n{resetToolbarToDefault}">
              $i18n{resetToDefault}
            </cr-button>
          </template>
        </div>
        <div id="colorSchemeModeRow" class="cr-row"

            hidden="[[!showColorSchemeMode_(prefs.extensions.theme.id.value,
              systemTheme_)]]"

        >
          <div id="colorSchemeModeLabel" class="flex cr-padded-text"
              aria-hidden="true">
            $i18n{colorSchemeMode}
          </div>
          <select id="colorSchemeModeSelect" class="md-select"
              on-change="onColorSchemeModeChange_"
              aria-labelledby="colorSchemeModeLabel">
            <template is="dom-repeat" items="[[colorSchemeModeOptions_]]">
              <option value="[[item.value]]"
                  selected="[[isSelectedColorSchemeMode_(
                      item.value, selectedColorSchemeMode_)]]">
                [[item.name]]
              </option>
            </template>
          </select>
        </div>
        <div
            class="hr"
            hidden="[[!showHr_(
                pageVisibility.setTheme, pageVisibility.homeButton)]]">
        </div>
        <settings-toggle-button elide-label
            hidden="[[!pageVisibility.homeButton]]"
            pref="{{prefs.browser.show_home_button}}"
            label="$i18n{showHomeButton}"
            sub-label="[[getShowHomeSubLabel_(
                prefs.browser.show_home_button.value,
                prefs.homepage_is_newtabpage.value,
                prefs.homepage.value)]]">
        </settings-toggle-button>
        <template is="dom-if" if="[[prefs.browser.show_home_button.value]]">
          <div id="home-button-options" class="list-frame"
              hidden="[[!pageVisibility.homeButton]]">
            <settings-radio-group pref="{{prefs.homepage_is_newtabpage}}">
              <controlled-radio-button class="list-item" name="true"
                  pref="[[prefs.homepage_is_newtabpage]]"
                  label="$i18n{homePageNtp}" no-extension-indicator>
              </controlled-radio-button>
              <controlled-radio-button id="custom-input" class="list-item"
                  name="false" pref="[[prefs.homepage_is_newtabpage]]"
                  no-extension-indicator>
                <!-- TODO(dbeam): this can show double indicators when both
                     homepage and whether to use the NTP as the homepage are
                     managed. -->
                <home-url-input id="customHomePage" pref="{{prefs.homepage}}"
                    can-tab="[[!prefs.homepage_is_newtabpage.value]]">
                </home-url-input>
              </controlled-radio-button>
              <template is="dom-if" if="[[prefs.homepage.extensionId]]">
                <extension-controlled-indicator
                    extension-id="[[prefs.homepage.extensionId]]"
                    extension-can-be-disabled="[[
                        prefs.homepage.extensionCanBeDisabled]]"
                    extension-name="[[prefs.homepage.controlledByName]]"
                    on-disable-extension="onDisableExtension_">
                </extension-controlled-indicator>
              </template>
            </settings-radio-group>
          </div>
        </template>
        <div
            class="hr"
            hidden="[[!showHr_(
                pageVisibility.homeButton, pageVisibility.bookmarksBar)]]">
        </div>
        <settings-toggle-button
            hidden="[[!pageVisibility.bookmarksBar]]"
            pref="{{prefs.bookmark_bar.show_on_all_tabs}}"
            label="$i18n{showBookmarksBar}">
        </settings-toggle-button>

        <template is="dom-if" if="[[showVerticalTabsEnabled_]]">
          <div class="cr-row">
            <div class="flex cr-padded-text" aria-hidden="true">
              $i18n{tabStripPosition}
            </div>
            <settings-dropdown-menu id="tabStripPosition"
                label="$i18n{tabStripPosition}"
                pref="{{prefs.vertical_tabs.enabled}}"
                menu-options="[[tabStripOptions_]]">
            </settings-dropdown-menu>
          </div>
        </template>

        <settings-toggle-button class="hr" id="showSavedTabGroups"
            pref="{{prefs.bookmark_bar.show_tab_groups}}"
            label="$i18n{showTabGroupsInBookmarksBar}">
        </settings-toggle-button>

        <settings-toggle-button class="hr" id="autoPinNewTabGroups"
            pref="{{prefs.auto_pin_new_tab_groups}}"
            label="$i18n{autoPinNewTabGroups}">
        </settings-toggle-button>

        <div class="cr-row">
          <div class="flex cr-padded-text" aria-hidden="true">
            $i18n{sidePanelPosition}
          </div>
          <settings-dropdown-menu id="sidePanelPosition"
              label="$i18n{sidePanelPosition}"
              pref="{{prefs.side_panel.is_right_aligned}}"
              menu-options="[[sidePanelOptions_]]">
          </settings-dropdown-menu>
        </div>
        <template is="dom-if" if="[[!showHoverCardImagesOption_]]">
          <div class="hr" hidden="[[!pageVisibility.hoverCard]]"></div>
          <settings-toggle-button id="hoverCardMemoryUsageToggle"
              hidden="[[!pageVisibility.hoverCard]]"
              pref="{{prefs.browser.hovercard.memory_usage_enabled}}"
              label="$i18n{showHoverCardMemoryUsageStandalone}">
          </settings-toggle-button>
        </template>
        <template is="dom-if" if="[[showHoverCardImagesOption_]]">
          <div class="cr-row" hidden="[[!pageVisibility.hoverCard]]">
            $i18n{hoverCardTitle}
          </div>
          <div class="list-frame hover-card-toggles">
            <settings-toggle-button id="hoverCardImagesToggle"
                hidden="[[!pageVisibility.hoverCard]]"
                on-settings-boolean-control-change="onHoverCardImagesToggleChange_"
                pref="{{prefs.browser.hovercard.image_previews_enabled}}"
                label="$i18n{showHoverCardImages}">
            </settings-toggle-button>
            <settings-toggle-button id="hoverCardMemoryUsageToggle" class="hr"
                hidden="[[!pageVisibility.hoverCard]]"
                pref="{{prefs.browser.hovercard.memory_usage_enabled}}"
                label="$i18n{showHoverCardMemoryUsage}">
            </settings-toggle-button>
          </div>
        </template>


        <div class="hr" hidden="[[!pageVisibility.bookmarksBar]]"></div>
        <settings-toggle-button
            hidden="[[!showCustomChromeFrame_]]"
            pref="{{prefs.browser.custom_chrome_frame}}"
            label="$i18n{showWindowDecorations}"
            inverted>
        </settings-toggle-button>

        <div class="cr-row">
          <div class="flex cr-padded-text" aria-hidden="true">
            $i18n{fontSize}
          </div>
          <settings-dropdown-menu id="defaultFontSize" label="$i18n{fontSize}"
              pref="{{prefs.webkit.webprefs.default_font_size}}"
              menu-options="[[fontSizeOptions_]]">
          </settings-dropdown-menu>
        </div>
        <cr-link-row class="hr" id="customize-fonts-subpage-trigger"
            label="$i18n{customizeFonts}" on-click="onCustomizeFontsClick_"
            role-description="$i18n{subpageArrowRoleDescription}">
        </cr-link-row>
        <div class="cr-row" hidden="[[!pageVisibility.pageZoom]]">
          <div id="pageZoom" class="flex cr-padded-text" aria-hidden="true">
            $i18n{pageZoom}
          </div>
          <select id="zoomLevel" class="md-select" aria-labelledby="pageZoom"
              on-change="onZoomLevelChange_">
            <template is="dom-repeat" items="[[pageZoomLevels_]]">
              <option value="[[item]]"
                  selected="[[zoomValuesEqual_(item, defaultZoom_)]]">
                [[formatZoom_(item)]]%
              </option>
            </template>
          </select>
        </div>

      </div>
      <settings-toggle-button class="hr" id="splitViewDragAndDrop"
          pref="{{prefs.browser.split_view_drag_and_drop_enabled}}"
          label="$i18n{allowSplitViewDragAndDrop}">
      </settings-toggle-button>
    </settings-section>
    <template is="dom-if" if="[[showManagedThemeDialog_]]" restamp>
      <managed-dialog on-close="onManagedDialogClosed_"
          title="$i18n{themeManagedDialogTitle}"
          body="$i18n{themeManagedDialogBody}">
      </managed-dialog>
    </template>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/appearance_page.js
/**
* This is the absolute difference maintained between standard and
* fixed-width font sizes. http://crbug.com/91922.
*/
var SIZE_DIFFERENCE_FIXED_STANDARD = 3;
/**
* ID for autogenerated themes. Should match
* |ThemeService::kAutogeneratedThemeID|.
*/
var AUTOGENERATED_THEME_ID = "autogenerated_theme_id";
/**
* ID for user color themes. Should match
* |ThemeService::kUserColorThemeID|.
*/
var USER_COLOR_THEME_ID = "user_color_theme_id";
var SystemTheme;
(function(SystemTheme) {
	SystemTheme[SystemTheme["DEFAULT"] = 0] = "DEFAULT";
	SystemTheme[SystemTheme["GTK"] = 1] = "GTK";
	SystemTheme[SystemTheme["QT"] = 2] = "QT";
})(SystemTheme || (SystemTheme = {}));
var SettingsAppearancePageElementBase = SettingsViewMixin(RelaunchMixin(I18nMixin(PrefsMixin(PolymerElement))));
var SettingsAppearancePageElement = class extends SettingsAppearancePageElementBase {
	static get is() {
		return "settings-appearance-page";
	}
	static get template() {
		return getTemplate$36();
	}
	static get properties() {
		return {
			/**
			* Dictionary defining page visibility.
			*/
			pageVisibility_: {
				type: Object,
				value: () => pageVisibility?.appearance
			},
			defaultZoom_: Number,
			isWallpaperPolicyControlled_: {
				type: Boolean,
				value: true
			},
			colorSchemeModeOptions_: {
				readOnly: true,
				type: Array,
				value() {
					return [
						{
							value: ColorSchemeMode.kLight,
							name: loadTimeData$1.getString("lightMode")
						},
						{
							value: ColorSchemeMode.kDark,
							name: loadTimeData$1.getString("darkMode")
						},
						{
							value: ColorSchemeMode.kSystem,
							name: loadTimeData$1.getString("systemMode")
						}
					];
				}
			},
			selectedColorSchemeMode_: Number,
			/**
			* List of options for the font size drop-down menu.
			*/
			fontSizeOptions_: {
				readOnly: true,
				type: Array,
				value() {
					return [
						{
							value: 9,
							name: loadTimeData$1.getString("verySmall")
						},
						{
							value: 12,
							name: loadTimeData$1.getString("small")
						},
						{
							value: 16,
							name: loadTimeData$1.getString("medium")
						},
						{
							value: 20,
							name: loadTimeData$1.getString("large")
						},
						{
							value: 24,
							name: loadTimeData$1.getString("veryLarge")
						}
					];
				}
			},
			/**
			* Predefined zoom factors to be used when zooming in/out. These are in
			* ascending order. Values are displayed in the page zoom drop-down menu
			* as percentages.
			*/
			pageZoomLevels_: Array,
			themeSublabel_: String,
			themeUrl_: String,
			systemTheme_: {
				type: Object,
				value: SystemTheme.DEFAULT
			},
			isForcedTheme_: {
				type: Boolean,
				computed: "computeIsForcedTheme_(prefs.autogenerated.theme.policy.color.controlledBy)"
			},
			/**
			* Whether to show the "Custom Chrome Frame" setting.
			*/
			showCustomChromeFrame_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("showCustomChromeFrame");
				}
			},
			showHoverCardImagesOption_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("showHoverCardImagesOption");
				}
			},
			showManagedThemeDialog_: Boolean,
			sidePanelOptions_: {
				readOnly: true,
				type: Array,
				value() {
					return [{
						value: "true",
						name: loadTimeData$1.getString("uiFeatureAlignRight")
					}, {
						value: "false",
						name: loadTimeData$1.getString("uiFeatureAlignLeft")
					}];
				}
			},
			tabStripOptions_: {
				readOnly: true,
				type: Array,
				value() {
					return [{
						value: "true",
						name: loadTimeData$1.getString("uiFeatureAlignSide")
					}, {
						value: "false",
						name: loadTimeData$1.getString("uiFeatureAlignTop")
					}];
				}
			},
			showVerticalTabsEnabled_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("showVerticalTabsEnabled");
				}
			},
			showTabSearchPositionRestartButton_: {
				type: Boolean,
				value: false
			},
			showResetPinnedActionsButton_: {
				type: Boolean,
				value: false
			},
			tabSearchOptions_: {
				readOnly: true,
				type: Array,
				value() {
					return [{
						value: "true",
						name: loadTimeData$1.getString("uiFeatureAlignRight")
					}, {
						value: "false",
						name: loadTimeData$1.getString("uiFeatureAlignLeft")
					}];
				}
			}
		};
	}
	static get observers() {
		return [
			"defaultFontSizeChanged_(prefs.webkit.webprefs.default_font_size.value)",
			"themeChanged_(prefs.extensions.theme.id.value, systemTheme_, isForcedTheme_)",
			"updateShowTabSearchRestartButton_(prefs.tab_search.is_right_aligned.value)",
			"systemThemePrefChanged_(prefs.extensions.theme.system_theme.value)",
			"toolbarPinningStateChanged_(prefs.toolbar.pinned_actions.value,prefs.browser.show_home_button.value,prefs.browser.show_forward_button.value)"
		];
	}
	appearanceBrowserProxy_ = AppearanceBrowserProxyImpl.getInstance();
	colorSchemeModeHandler_ = CustomizeColorSchemeModeBrowserProxy.getInstance().handler;
	colorSchemeModeCallbackRouter_ = CustomizeColorSchemeModeBrowserProxy.getInstance().callbackRouter;
	setColorSchemeModeListenerId_ = null;
	ready() {
		super.ready();
		this.$.defaultFontSize.menuOptions = this.fontSizeOptions_;
		this.appearanceBrowserProxy_.getDefaultZoom().then((zoom) => {
			this.defaultZoom_ = zoom;
		});
		this.pageZoomLevels_ = JSON.parse(loadTimeData$1.getString("presetZoomFactors"));
		this.setColorSchemeModeListenerId_ = this.colorSchemeModeCallbackRouter_.setColorSchemeMode.addListener((colorSchemeMode) => {
			this.selectedColorSchemeMode_ = this.colorSchemeModeOptions_.find((mode) => colorSchemeMode === mode.value)?.value;
		});
		this.colorSchemeModeHandler_.initializeColorSchemeMode();
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		assert(this.setColorSchemeModeListenerId_);
		this.colorSchemeModeCallbackRouter_.removeListener(this.setColorSchemeModeListenerId_);
	}
	/** @return A zoom easier read by users. */
	formatZoom_(zoom) {
		return Math.round(zoom * 100);
	}
	/**
	* @param showHomepage Whether to show home page.
	* @param isNtp Whether to use the NTP as the home page.
	* @param homepageValue If not using NTP, use this URL.
	*/
	getShowHomeSubLabel_(showHomepage, isNtp, homepageValue) {
		if (!showHomepage) return this.i18n("homeButtonDisabled");
		if (isNtp) return this.i18n("homePageNtp");
		return homepageValue || this.i18n("customWebAddress");
	}
	onCustomizeFontsClick_() {
		Router.getInstance().navigateTo(routes.FONTS);
	}
	onDisableExtension_() {
		this.dispatchEvent(new CustomEvent("refresh-pref", {
			bubbles: true,
			composed: true,
			detail: "homepage"
		}));
	}
	/**
	* @param value The changed font size slider value.
	*/
	defaultFontSizeChanged_(value) {
		this.set("prefs.webkit.webprefs.default_fixed_font_size.value", value - SIZE_DIFFERENCE_FIXED_STANDARD);
	}
	onThemeClick_() {
		this.appearanceBrowserProxy_.openCustomizeChrome();
	}
	onCustomizeToolbarClick_() {
		this.appearanceBrowserProxy_.openCustomizeChromeToolbarSection();
	}
	onUseDefaultClick_() {
		if (this.isForcedTheme_) {
			this.showManagedThemeDialog_ = true;
			return;
		}
		this.appearanceBrowserProxy_.useDefaultTheme();
	}
	onResetPinnedToolbarActionsClick_() {
		this.appearanceBrowserProxy_.resetPinnedToolbarActions();
	}
	systemThemePrefChanged_(systemTheme) {
		this.systemTheme_ = systemTheme;
	}
	/** @return Whether to show the "USE CLASSIC" button. */
	showUseClassic_(themeId) {
		return !!themeId || this.systemTheme_ !== SystemTheme.DEFAULT;
	}
	/** @return Whether to show the "USE GTK" button. */
	showUseGtk_(themeId) {
		return (!!themeId || this.systemTheme_ !== SystemTheme.GTK) && !this.appearanceBrowserProxy_.isChildAccount();
	}
	/** @return Whether to show the "USE QT" button. */
	showUseQt_(themeId) {
		return (!!themeId || this.systemTheme_ !== SystemTheme.QT) && !this.appearanceBrowserProxy_.isChildAccount();
	}
	/**
	* @return Whether to show the secondary area where "USE CLASSIC",
	*     "USE GTK", and "USE QT" buttons live.
	*/
	showThemesSecondary_(themeId) {
		return !!themeId || !this.appearanceBrowserProxy_.isChildAccount();
	}
	onUseGtkClick_() {
		if (this.isForcedTheme_) {
			this.showManagedThemeDialog_ = true;
			return;
		}
		this.appearanceBrowserProxy_.useGtkTheme();
	}
	onUseQtClick_() {
		if (this.isForcedTheme_) {
			this.showManagedThemeDialog_ = true;
			return;
		}
		this.appearanceBrowserProxy_.useQtTheme();
	}
	/** @return Whether to show the color scheme mode toggle. */
	showColorSchemeMode_(themeId) {
		return !!themeId || this.systemTheme_ !== SystemTheme.GTK && this.systemTheme_ !== SystemTheme.QT;
	}
	themeChanged_(themeId) {
		if (this.prefs === void 0 || this.systemTheme_ === void 0) return;
		if (themeId.length > 0 && themeId !== AUTOGENERATED_THEME_ID && themeId !== USER_COLOR_THEME_ID && !this.isForcedTheme_) {
			assert(this.systemTheme_ === SystemTheme.DEFAULT);
			this.appearanceBrowserProxy_.getThemeInfo(themeId).then((info) => {
				this.themeSublabel_ = info.name;
			});
			this.themeUrl_ = "https://chrome.google.com/webstore/detail/" + themeId;
			return;
		}
		this.themeUrl_ = "";
		if (themeId === AUTOGENERATED_THEME_ID || themeId === USER_COLOR_THEME_ID || this.isForcedTheme_) {
			this.themeSublabel_ = this.i18n("chromeColors");
			return;
		}
		let i18nId;
		switch (this.systemTheme_) {
			case SystemTheme.GTK:
				i18nId = "gtkTheme";
				break;
			case SystemTheme.QT:
				i18nId = "qtTheme";
				break;
			default: i18nId = "classicTheme";
		}
		this.themeSublabel_ = this.i18n(i18nId);
	}
	/** @return Whether applied theme is set by policy. */
	computeIsForcedTheme_() {
		return !!this.getPref("autogenerated.theme.policy.color").controlledBy;
	}
	async toolbarPinningStateChanged_() {
		this.showResetPinnedActionsButton_ = !await this.appearanceBrowserProxy_.pinnedToolbarActionsAreDefault();
	}
	isSelectedColorSchemeMode_(colorSchemeMode) {
		return colorSchemeMode === this.selectedColorSchemeMode_;
	}
	onColorSchemeModeChange_() {
		this.colorSchemeModeHandler_.setColorSchemeMode(parseInt(this.$.colorSchemeModeSelect.value, 10));
	}
	onZoomLevelChange_() {
		chrome.settingsPrivate.setDefaultZoom(parseFloat(this.$.zoomLevel.value));
	}
	/** @see blink::ZoomValuesEqual(). */
	zoomValuesEqual_(zoom1, zoom2) {
		return Math.abs(zoom1 - zoom2) <= .001;
	}
	showHr_(previousIsVisible, nextIsVisible) {
		return previousIsVisible && nextIsVisible;
	}
	onHoverCardImagesToggleChange_(event) {
		const enabled = event.target.checked;
		this.appearanceBrowserProxy_.recordHoverCardImagesEnabledChanged(enabled);
	}
	onManagedDialogClosed_() {
		this.showManagedThemeDialog_ = false;
	}
	onTabSearchPositionRestartClick_(e) {
		e.stopPropagation();
		this.performRestart(RestartType.RESTART);
	}
	updateShowTabSearchRestartButton_(newValue) {
		this.showTabSearchPositionRestartButton_ = newValue !== loadTimeData$1.getBoolean("tabSearchIsRightAlignedAtStartup");
	}
	getFocusConfig() {
		const map = /* @__PURE__ */ new Map();
		if (routes.FONTS) map.set(routes.FONTS.path, "#customize-fonts-subpage-trigger");
		return map;
	}
	getAssociatedControlFor(childViewId) {
		assert(childViewId === "fonts");
		const control = this.shadowRoot.querySelector("#customize-fonts-subpage-trigger");
		assert(control);
		return control;
	}
};
customElements.define(SettingsAppearancePageElement.is, SettingsAppearancePageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/appearance_page_index.html.js
function getTemplate$35() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">
  <settings-appearance-page slot="view" id="parent" prefs="{{prefs}}"
      route-path$="[[routes_.APPEARANCE.path]]">
  </settings-appearance-page>

  <settings-appearance-fonts-page slot="view" id="fonts"
      data-parent-view-id="parent" prefs="{{prefs}}"
      route-path$="[[routes_.FONTS.path]]">
  </settings-appearance-fonts-page>
</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/appearance_page/appearance_page_index.js
var SettingsAppearancePageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(PolymerElement));
var SettingsAppearancePageIndexElement = class extends SettingsAppearancePageIndexElementBase {
	static get is() {
		return "settings-appearance-page-index";
	}
	static get template() {
		return getTemplate$35();
	}
	static get properties() {
		return {
			prefs: Object,
			routes_: {
				type: Object,
				value: () => routes
			}
		};
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.APPEARANCE:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.FONTS:
					this.$.viewManager.switchView("fonts", "no-animation", "no-animation");
					break;
				case routes.BASIC: this.$.viewManager.switchView("parent", "no-animation", "no-animation");
			}
		});
	}
};
customElements.define(SettingsAppearancePageIndexElement.is, SettingsAppearancePageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_page.html.js
function getTemplate$34() {
	return Ke`<!--_html_template_start_-->    <style include="settings-shared">cr-link-row{--cr-icon-button-margin-start:20px}cr-link-row:not([hidden])~cr-link-row{border-top:var(--cr-separator-line)}
    </style>
    <settings-section page-title="$i18n{autofillPageTitle}">
      <div route-path="default">
        <cr-link-row id="passwordManagerButton"
            label="$i18n{localPasswordManager}" on-click="onPasswordsClick_"
            role-description="$i18n{subpageArrowRoleDescription}"
            start-icon="cr20:password" external>
        </cr-link-row>
        <cr-link-row id="paymentManagerButton"
            start-icon="settings20:credit-card" label="$i18n{creditCards}"
            on-click="onPaymentsClick_"
            role-description="$i18n{subpageArrowRoleDescription}"></cr-link-row>
        <cr-link-row id="addressesManagerButton"
            start-icon="settings:location-on" label="$i18n{addressesTitle}"
            sub-label="[[addressesSublabel_()]]"
            on-click="onAddressesClick_"
            role-description="$i18n{subpageArrowRoleDescription}"></cr-link-row>
        <template is="dom-if" if="[[autofillAiAvailable_]]">
          <cr-link-row id="autofillAiManagerButton"
              start-icon="settings20:text-analysis"
              label="$i18n{autofillAiPageTitle}"
              sub-label="$i18n{autofillAiDescription}"
              on-click="onAutofillAiClick_"></cr-link-row>
        </template>
      </div>
    </settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_page.js
var SettingsAutofillPageElementBase = SettingsViewMixin(PrefsMixin(I18nMixin$1(PolymerElement)));
var SettingsAutofillPageElement = class extends SettingsAutofillPageElementBase {
	static get is() {
		return "settings-autofill-page";
	}
	static get template() {
		return getTemplate$34();
	}
	static get properties() {
		return { autofillAiAvailable_: {
			type: Boolean,
			value() {
				return loadTimeData$1.getBoolean("showAutofillAiControl");
			}
		} };
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	/**
	* Shows the manage addresses sub page.
	*/
	onAddressesClick_() {
		this.metricsBrowserProxy_.recordAutofillSettingsReferrer("Autofill.AddressesSettingsPage.VisitReferrer", AutofillSettingsReferrer.AUTOFILL_AND_PASSWORDS_PAGE);
		Router.getInstance().navigateTo(routes.ADDRESSES);
	}
	/**
	* Shows the manage payment methods sub page.
	*/
	onPaymentsClick_() {
		this.metricsBrowserProxy_.recordAutofillSettingsReferrer("Autofill.PaymentMethodsSettingsPage.VisitReferrer", AutofillSettingsReferrer.AUTOFILL_AND_PASSWORDS_PAGE);
		Router.getInstance().navigateTo(routes.PAYMENTS);
	}
	/**
	* Shows Password Manager page.
	*/
	onPasswordsClick_() {
		PasswordManagerImpl.getInstance().recordPasswordsPageAccessInSettings();
		PasswordManagerImpl.getInstance().showPasswordManager(PasswordManagerPage.PASSWORDS);
	}
	/**
	* Shows the Autofill AI settings sub page.
	*/
	onAutofillAiClick_() {
		this.metricsBrowserProxy_.recordAutofillSettingsReferrer("Autofill.FormsAiSettingsPage.VisitReferrer", AutofillSettingsReferrer.AUTOFILL_AND_PASSWORDS_PAGE);
		Router.getInstance().navigateTo(routes.AUTOFILL_AI);
	}
	/**
	* @returns the sublabel of the address entry.
	*/
	addressesSublabel_() {
		return loadTimeData$1.getBoolean("plusAddressEnabled") ? this.i18n("addressesSublabel") : "";
	}
	getFocusConfig() {
		const map = /* @__PURE__ */ new Map();
		if (routes.PAYMENTS) map.set(routes.PAYMENTS.path, "#paymentManagerButton");
		if (routes.ADDRESSES) map.set(routes.ADDRESSES.path, "#addressesManagerButton");
		return map;
	}
	getAssociatedControlFor(childViewId) {
		assert([
			"addresses",
			"autofillAi",
			"payments"
		].includes(childViewId));
		let triggerId = null;
		switch (childViewId) {
			case "addresses":
				triggerId = "addressesManagerButton";
				break;
			case "autofillAi":
				assert(this.autofillAiAvailable_);
				triggerId = "autofillAiManagerButton";
				break;
			case "payments": triggerId = "paymentManagerButton";
		}
		assert(triggerId);
		const control = this.shadowRoot.querySelector(`#${triggerId}`);
		assert(control);
		return control;
	}
};
customElements.define(SettingsAutofillPageElement.is, SettingsAutofillPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_page_index.html.js
function getTemplate$33() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">
  <settings-autofill-page slot="view" id="parent" prefs="{{prefs}}">
  </settings-autofill-page>

  <settings-payments-section slot="view" id="payments" prefs="{{prefs}}"
      data-parent-view-id="parent">
  </settings-payments-section>

  <settings-autofill-section slot="view" id="addresses" prefs="{{prefs}}"
      data-parent-view-id="parent">
  </settings-autofill-section>

  <template is="dom-if" if="[[autofillAiAvailable_]]">
    <settings-autofill-ai-section slot="view" id="autofillAi" prefs="{{prefs}}"
        data-parent-view-id="parent">
    </settings-autofill-ai-section>
  </template>


</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_page_index.js
var SettingsAutofillPageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(PolymerElement));
var SettingsAutofillPageIndexElement = class extends SettingsAutofillPageIndexElementBase {
	static get is() {
		return "settings-autofill-page-index";
	}
	static get template() {
		return getTemplate$33();
	}
	static get properties() {
		return {
			prefs: Object,
			autofillAiAvailable_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("showAutofillAiControl");
				}
			}
		};
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.AUTOFILL:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.PAYMENTS:
					this.$.viewManager.switchView("payments", "no-animation", "no-animation");
					break;
				case routes.ADDRESSES:
					this.$.viewManager.switchView("addresses", "no-animation", "no-animation");
					break;
				case routes.AUTOFILL_AI:
					assert(this.autofillAiAvailable_);
					this.$.viewManager.switchView("autofillAi", "no-animation", "no-animation");
					break;
				case routes.BASIC: this.$.viewManager.switchView("parent", "no-animation", "no-animation");
			}
		});
	}
};
customElements.define(SettingsAutofillPageIndexElement.is, SettingsAutofillPageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_url_dialog.html.js
function getTemplate$32() {
	return Ke`<!--_html_template_start_-->    <style include="settings-shared"></style>
    <cr-dialog id="dialog" close-text="$i18n{close}">
      <div slot="title">[[dialogTitle_]]</div>
      <div slot="body">
        <cr-input id="url" label="$i18n{onStartupSiteUrl}"
            value="{{url_}}" on-input="validate_" spellcheck="false"
            maxlength="[[urlLimit_]]" invalid="[[hasError_(error_)]]" autofocus
            error-message="[[errorMessage_('$i18nPolymer{onStartupInvalidUrl}',
                '$i18nPolymer{onStartupUrlTooLong}', error_)]]">
        </cr-input>
      </div>
      <div slot="button-container">
        <cr-button class="cancel-button" on-click="onCancelClick_"
            id="cancel">$i18n{cancel}</cr-button>
        <cr-button id="actionButton" class="action-button"
            on-click="onActionButtonClick_">[[actionButtonText_]]</cr-button>
      </div>
    </cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_urls_page_browser_proxy.js
var StartupUrlsPageBrowserProxyImpl = class StartupUrlsPageBrowserProxyImpl {
	loadStartupPages() {
		chrome.send("onStartupPrefsPageLoad");
	}
	useCurrentPages() {
		chrome.send("setStartupPagesToCurrentPages");
	}
	validateStartupPage(url) {
		return sendWithPromise("validateStartupPage", url);
	}
	addStartupPage(url) {
		return sendWithPromise("addStartupPage", url);
	}
	editStartupPage(modelIndex, url) {
		return sendWithPromise("editStartupPage", modelIndex, url);
	}
	removeStartupPage(index) {
		chrome.send("removeStartupPage", [index]);
	}
	static getInstance() {
		return instance$5 || (instance$5 = new StartupUrlsPageBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$5 = obj;
	}
};
var instance$5 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_url_dialog.js
/**
* Describe the current URL input error status.
* @enum {number}
*/
var UrlInputError;
(function(UrlInputError) {
	UrlInputError[UrlInputError["NONE"] = 0] = "NONE";
	UrlInputError[UrlInputError["INVALID_URL"] = 1] = "INVALID_URL";
	UrlInputError[UrlInputError["TOO_LONG"] = 2] = "TOO_LONG";
})(UrlInputError || (UrlInputError = {}));
var SettingsStartupUrlDialogElement = class extends PolymerElement {
	static get is() {
		return "settings-startup-url-dialog";
	}
	static get template() {
		return getTemplate$32();
	}
	static get properties() {
		return {
			error_: {
				type: Number,
				value: UrlInputError.NONE
			},
			url_: String,
			urlLimit_: {
				readOnly: true,
				type: Number,
				value: 102400
			},
			/**
			* If specified the dialog acts as an "Edit page" dialog, otherwise as an
			* "Add new page" dialog.
			*/
			model: Object,
			dialogTitle_: String,
			actionButtonText_: String
		};
	}
	browserProxy_ = StartupUrlsPageBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		if (this.model) {
			this.dialogTitle_ = loadTimeData$1.getString("onStartupEditPage");
			this.actionButtonText_ = loadTimeData$1.getString("save");
			this.$.actionButton.disabled = false;
			this.url_ = this.model.url;
		} else {
			this.dialogTitle_ = loadTimeData$1.getString("onStartupAddNewPage");
			this.actionButtonText_ = loadTimeData$1.getString("add");
			this.$.actionButton.disabled = true;
		}
		this.$.dialog.showModal();
	}
	hasError_() {
		return this.error_ !== UrlInputError.NONE;
	}
	errorMessage_(invalidUrl, tooLong) {
		return [
			"",
			invalidUrl,
			tooLong
		][this.error_];
	}
	onCancelClick_() {
		this.$.dialog.close();
	}
	onActionButtonClick_() {
		(this.model ? this.browserProxy_.editStartupPage(this.model.modelIndex, this.url_) : this.browserProxy_.addStartupPage(this.url_)).then((success) => {
			if (success) this.$.dialog.close();
		});
	}
	validate_() {
		if (this.url_.length === 0) {
			this.$.actionButton.disabled = true;
			this.error_ = UrlInputError.NONE;
			return;
		}
		if (this.url_.length >= this.urlLimit_) {
			this.$.actionButton.disabled = true;
			this.error_ = UrlInputError.TOO_LONG;
			return;
		}
		this.browserProxy_.validateStartupPage(this.url_).then((isValid) => {
			this.$.actionButton.disabled = !isValid;
			this.error_ = isValid ? UrlInputError.NONE : UrlInputError.INVALID_URL;
		});
	}
};
customElements.define(SettingsStartupUrlDialogElement.is, SettingsStartupUrlDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_url_entry.html.js
function getTemplate$31() {
	return Ke`<!--_html_template_start_-->    <style include="settings-shared">.hide-overflow{overflow:hidden}
    </style>
    <div class="list-item" focus-row-container>
      <site-favicon url="[[model.url]]"></site-favicon>
      <div class="middle hide-overflow">
        <div class="text-elide">[[model.title]]</div>
        <div class="text-elide secondary">[[model.url]]</div>
      </div>
      <template is="dom-if" if="[[editable]]">
        <cr-icon-button class="icon-more-vert" id="dots" on-click="onDotsClick_"
            title="$i18n{moreActions}" focus-row-control focus-type="menu">
        </cr-icon-button>
        <cr-lazy-render id="menu">
          <template>
            <cr-action-menu role-description="$i18n{menu}">
              <button class="dropdown-item" on-click="onEditClick_">
                $i18n{edit}
              </button>
              <button class="dropdown-item" id="remove"
                  on-click="onRemoveClick_">
                $i18n{onStartupRemove}
              </button>
            </cr-action-menu>
          </template>
        </cr-lazy-render>
      </template>
    </div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_url_entry.js
/**
* The name of the event fired from this element when the "Edit" option is
* clicked.
*/
var EDIT_STARTUP_URL_EVENT = "edit-startup-url";
var SettingsStartupUrlEntryElementBase = FocusRowMixin(PolymerElement);
var SettingsStartupUrlEntryElement = class extends SettingsStartupUrlEntryElementBase {
	static get is() {
		return "settings-startup-url-entry";
	}
	static get template() {
		return getTemplate$31();
	}
	static get properties() {
		return {
			editable: {
				type: Boolean,
				reflectToAttribute: true
			},
			model: Object
		};
	}
	onRemoveClick_() {
		this.shadowRoot.querySelector("cr-action-menu").close();
		StartupUrlsPageBrowserProxyImpl.getInstance().removeStartupPage(this.model.modelIndex);
	}
	onEditClick_(e) {
		e.preventDefault();
		this.shadowRoot.querySelector("cr-action-menu").close();
		this.dispatchEvent(new CustomEvent(EDIT_STARTUP_URL_EVENT, {
			bubbles: true,
			composed: true,
			detail: {
				model: this.model,
				anchor: this.shadowRoot.querySelector("#dots")
			}
		}));
	}
	onDotsClick_() {
		const actionMenu = this.shadowRoot.querySelector("#menu").get();
		const dots = this.shadowRoot.querySelector("#dots");
		assert(dots);
		actionMenu.showAt(dots);
	}
};
customElements.define(SettingsStartupUrlEntryElement.is, SettingsStartupUrlEntryElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_urls_page.html.js
function getTemplate$30() {
	return Ke`<!--_html_template_start_-->    <style include="settings-shared action-link">#editOptions>div{border-top:var(--cr-separator-line)}#outer{display:flex;flex-direction:column;max-height:355px}#container settings-startup-url-entry{cursor:default}
    </style>
    <div id="outer" class="flex list-frame">
      <div id="container" class="scroll-container" scrollable>
        <iron-list items="[[startupPages_]]" scroll-target="container"
            preserve-focus risk-selection class="cr-separators">
          <template>
            <settings-startup-url-entry model="[[item]]" first$="[[!index]]"
                tabindex$="[[tabIndex]]" iron-list-tab-index="[[tabIndex]]"
                last-focused="{{lastFocused_}}" list-blurred="{{listBlurred_}}"
                focus-row-index="[[index]]" editable="[[shouldAllowUrlsEdit_(
                    prefs.session.startup_urls.enforcement)]]">
            </settings-startup-url-entry>
          </template>
        </iron-list>
      </div>
    </div>
    <div id="editOptions" class="list-frame">
      <template is="dom-if" if="[[shouldAllowUrlsEdit_(
          prefs.session.startup_urls.enforcement)]]" restamp>
        <div class="list-item" id="addPage">
          <a is="action-link" class="list-button" on-click="onAddPageClick_">
            $i18n{onStartupAddNewPage}
          </a>
        </div>
        <div class="list-item" id="useCurrentPages">
          <a is="action-link" class="list-button"
              on-click="onUseCurrentPagesClick_">
            $i18n{onStartupUseCurrent}
          </a>
        </div>
      </template>
      <template is="dom-if" if="[[prefs.session.startup_urls.extensionId]]"
          restamp>
        <extension-controlled-indicator
            extension-id="[[prefs.session.startup_urls.extensionId]]"
            extension-name="[[prefs.session.startup_urls.controlledByName]]"
            extension-can-be-disabled="[[
                prefs.session.startup_urls.extensionCanBeDisabled]]">
        </extension-controlled-indicator>
      </template>
    </div>
    <template is="dom-if" if="[[showStartupUrlDialog_]]" restamp>
      <settings-startup-url-dialog model="[[startupUrlDialogModel_]]"
          on-close="destroyUrlDialog_">
      </settings-startup-url-dialog>
    </template>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/startup_urls_page.js
var SettingsStartupUrlsPageElementBase = ScrollableMixin(WebUiListenerMixin(PolymerElement));
var SettingsStartupUrlsPageElement = class extends SettingsStartupUrlsPageElementBase {
	static get is() {
		return "settings-startup-urls-page";
	}
	static get template() {
		return getTemplate$30();
	}
	static get properties() {
		return {
			prefs: Object,
			/**
			* Pages to load upon browser startup.
			*/
			startupPages_: Array,
			showStartupUrlDialog_: Boolean,
			startupUrlDialogModel_: Object,
			lastFocused_: Object,
			listBlurred_: Boolean
		};
	}
	browserProxy_ = StartupUrlsPageBrowserProxyImpl.getInstance();
	startupUrlDialogAnchor_;
	constructor() {
		super();
		/**
		* The element to return focus to, when the startup-url-dialog is closed.
		*/
		this.startupUrlDialogAnchor_ = null;
	}
	connectedCallback() {
		super.connectedCallback();
		this.addWebUiListener("update-startup-pages", (startupPages) => {
			if (this.startupUrlDialogModel_) this.destroyUrlDialog_();
			this.startupPages_ = startupPages;
			this.updateScrollableContents();
		});
		this.browserProxy_.loadStartupPages();
		this.addEventListener(EDIT_STARTUP_URL_EVENT, (event) => {
			const e = event;
			this.startupUrlDialogModel_ = e.detail.model;
			this.startupUrlDialogAnchor_ = e.detail.anchor;
			this.showStartupUrlDialog_ = true;
			e.stopPropagation();
		});
	}
	onAddPageClick_(e) {
		e.preventDefault();
		this.showStartupUrlDialog_ = true;
		this.startupUrlDialogAnchor_ = this.shadowRoot.querySelector("#addPage a[is=action-link]");
	}
	destroyUrlDialog_() {
		this.showStartupUrlDialog_ = false;
		this.startupUrlDialogModel_ = null;
		if (this.startupUrlDialogAnchor_) {
			focusWithoutInk(this.startupUrlDialogAnchor_);
			this.startupUrlDialogAnchor_ = null;
		}
	}
	onUseCurrentPagesClick_() {
		this.browserProxy_.useCurrentPages();
	}
	/**
	* @return Whether "Add new page" and "Use current pages" are allowed.
	*/
	shouldAllowUrlsEdit_() {
		return this.get("prefs.session.startup_urls.enforcement") !== chrome.settingsPrivate.Enforcement.ENFORCED;
	}
};
customElements.define(SettingsStartupUrlsPageElement.is, SettingsStartupUrlsPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/on_startup_browser_proxy.js
var OnStartupBrowserProxyImpl = class OnStartupBrowserProxyImpl {
	getNtpExtension() {
		return sendWithPromise("getNtpExtension");
	}
	static getInstance() {
		return instance$4 || (instance$4 = new OnStartupBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$4 = obj;
	}
};
var instance$4 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/on_startup_page.html.js
function getTemplate$29() {
	return Ke`<!--_html_template_start_-->  <style include="cr-shared-style settings-shared"></style>
  <settings-section page-title="$i18n{onStartup}"
      class="cr-centered-card-container">
    <div class="cr-row first">
      <settings-radio-group id="onStartupRadioGroup"
          class="flex"
          pref="{{prefs.session.restore_on_startup}}"
          group-aria-label="$i18n{onStartup}">
        <controlled-radio-button name="[[getName_(prefValuesEnum_.OPEN_NEW_TAB)]]"
            pref="[[prefs.session.restore_on_startup]]"
            label="$i18n{onStartupOpenNewTab}"
            no-extension-indicator>
        </controlled-radio-button>
        <template is="dom-if" if="[[ntpExtension_]]">
          <extension-controlled-indicator
              extension-id="[[ntpExtension_.id]]"
              extension-name="[[ntpExtension_.name]]"
              extension-can-be-disabled="[[ntpExtension_.canBeDisabled]]">
          </extension-controlled-indicator>
        </template>
        <controlled-radio-button name="[[getName_(prefValuesEnum_.CONTINUE)]]"
            pref="[[prefs.session.restore_on_startup]]"
            label="$i18n{onStartupContinue}">
        </controlled-radio-button>
        <controlled-radio-button name="[[getName_(prefValuesEnum_.OPEN_SPECIFIC)]]"
            pref="[[prefs.session.restore_on_startup]]"
            label="$i18n{onStartupOpenSpecific}">
        </controlled-radio-button>
        <controlled-radio-button name="[[getName_(
          prefValuesEnum_.CONTINUE_AND_OPEN_SPECIFIC)]]"
            pref="[[prefs.session.restore_on_startup]]"
            label="$i18n{onStartupContinueAndOpenSpecific}"
            hidden="[[!showContinueAndOpenSpecific_(
              prefs.session.restore_on_startup)]]">
        </controlled-radio-button>
      </settings-radio-group>
    </div>
    <template is="dom-if"
        if="[[showStartupUrls_(prefs.session.restore_on_startup.value)]]">
      <settings-startup-urls-page prefs="[[prefs]]">
      </settings-startup-urls-page>
    </template>
 
  </settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/on_startup_page/on_startup_page.js
/** Enum values for the 'session.restore_on_startup' preference. */
var PrefValues;
(function(PrefValues) {
	PrefValues[PrefValues["CONTINUE"] = 1] = "CONTINUE";
	PrefValues[PrefValues["OPEN_NEW_TAB"] = 5] = "OPEN_NEW_TAB";
	PrefValues[PrefValues["OPEN_SPECIFIC"] = 4] = "OPEN_SPECIFIC";
	PrefValues[PrefValues["CONTINUE_AND_OPEN_SPECIFIC"] = 6] = "CONTINUE_AND_OPEN_SPECIFIC";
})(PrefValues || (PrefValues = {}));
var SettingsOnStartupPageElementBase = WebUiListenerMixin(PolymerElement);
var SettingsOnStartupPageElement = class extends SettingsOnStartupPageElementBase {
	static get is() {
		return "settings-on-startup-page";
	}
	static get template() {
		return getTemplate$29();
	}
	static get properties() {
		return {
			prefs: {
				type: Object,
				notify: true
			},
			ntpExtension_: Object,
			prefValuesEnum_: {
				readOnly: true,
				type: Object,
				value: PrefValues
			}
		};
	}
	connectedCallback() {
		super.connectedCallback();
		const updateNtpExtension = (ntpExtension) => {
			this.ntpExtension_ = ntpExtension;
		};
		OnStartupBrowserProxyImpl.getInstance().getNtpExtension().then(updateNtpExtension);
		this.addWebUiListener("update-ntp-extension", updateNtpExtension);
	}
	getName_(value) {
		return value.toString();
	}
	/**
	* Determine whether to show the user defined startup pages.
	* @param restoreOnStartup Enum value from PrefValues.
	* @return Whether the "open specific pages" or "continue and open specific
	*     pages" is selected.
	*/
	showStartupUrls_(restoreOnStartup) {
		return restoreOnStartup === PrefValues.OPEN_SPECIFIC || restoreOnStartup === PrefValues.CONTINUE_AND_OPEN_SPECIFIC;
	}
	/**
	* Determine whether to show "continue and open specific pages" option.
	* @param restoreOnStartup pref.
	* @return Whether the restoreOnStartup pref is recommended or enforced by
	*     policy.
	*/
	showContinueAndOpenSpecific_(pref) {
		return pref.enforcement === chrome.settingsPrivate.Enforcement.ENFORCED || pref.enforcement === chrome.settingsPrivate.Enforcement.RECOMMENDED;
	}
	async searchContents(query) {
		return (await getSearchManager().search(query, this)).getSearchResult();
	}
};
customElements.define(SettingsOnStartupPageElement.is, SettingsOnStartupPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/people_page/people_page.html.js
function getTemplate$28() {
	return Ke`<!--_html_template_start_-->    <style include="cr-shared-style settings-shared">.sync-row{align-items:center;flex:auto}#profile-icon{background:center/cover no-repeat;border-radius:20px;flex-shrink:0;height:40px;width:40px}#sync-setup{--cr-secondary-text-color:var(--settings-error-color)}#sync-not-allowed{border-top:var(--cr-separator-line);background:var(--google-grey-100)}#sync-not-allowed-text{margin-left:8px}cr-link-row{--cr-link-row-icon-width:40px;border-top:var(--cr-separator-line)}.icon-container{display:flex;flex-shrink:0;justify-content:center;width:40px}#toast{left:0;z-index:1}:host-context([dir='rtl']) #toast{left:auto;right:0}settings-sync-account-control[showing-promo]::part(banner){border-top-left-radius:var(--cr-card-border-radius);border-top-right-radius:var(--cr-card-border-radius)}settings-sync-account-control[showing-promo]::part(title){font-size:1.1rem;line-height:1.625rem}@media (prefers-color-scheme:dark){#sync-not-allowed{background:var(--google-grey-800)}}
    </style>
    <settings-section page-title="$i18n{peoplePageTitle}">
      <div>


        <template is="dom-if" if="[[shouldShowSyncAccountControl_(
            syncStatus.syncSystemEnabled, syncStatus.signedInStatus)]]" restamp>
          <settings-sync-account-control
              sync-status="[[syncStatus]]"
              prefs="{{prefs}}"
              promo-label-with-account="$i18n{peopleSignInPrompt}"
              promo-label-with-no-account="$i18n{peopleSignInPrompt}"
              promo-secondary-label-with-account=
                  "$i18n{peopleSignInPromptSecondaryWithAccount}"
              promo-secondary-label-with-no-account=
                  "$i18n{peopleSignInPromptSecondaryWithNoAccount}"
              access-point="[[accessPointEnum_.SETTINGS]]">
          </settings-sync-account-control>
        </template>

        <template is="dom-if" if="[[shouldLinkToProfileRow_(
            syncStatus.syncSystemEnabled, signinAllowed_,
            syncStatus.signedInState)]]" restamp>
          <div id="profile-row" class="cr-row first two-line"
              actionable$="[[isProfileActionable_]]"
              on-click="onProfileClick_">
            <template is="dom-if" if="[[syncStatus]]">
              <div id="profile-icon"
                  style="background-image: [[getIconImageSet_(
                      profileIconUrl_)]]">
              </div>
              <div class="flex cr-row-gap cr-padded-text text-elide">
                <span id="profile-name">[[profileName_]]</span>
              </div>
              <cr-icon-button class="subpage-arrow"
                  aria-label="$i18n{editPerson}"
                  aria-describedby="profile-name"
                  aria-roledescription="$i18n{subpageArrowRoleDescription}">
              </cr-icon-button>
            </template>
          </div>
        </template>

        <cr-link-row id="account-subpage-row" on-click="onAccountClick_"
            hidden="[[!shouldLinkToAccountSettingsPage_(
              syncStatus.signedInState)]]">
          <div id="profile-icon"
              style="background-image: [[getIconImageSet_(
                  primaryAccountIconUrl_)]]">
          </div>
          <div class="cr-row-gap cr-padded-text flex no-min-width">
            <div id="account-name" class="text-elide">
              [[primaryAccountName_]]
            </div>
            <div id="account-subtitle" class="secondary">
              [[getAccountRowSubtitle_(primaryAccountEmail_, syncStatus)]]
            </div>
          </div>
        </cr-link-row>

        <cr-link-row id="sync-setup"
            label="$i18n{syncAndNonPersonalizedServices}"
            on-click="onSyncClick_"
            role-description="$i18n{subpageArrowRoleDescription}"
            hidden="[[shouldHideSyncSetupLinkRow_(syncStatus)]]">
        </cr-link-row>
        <cr-link-row id="google-services"
            label="$i18n{googleServicesPageTitle}"
            on-click="onGoogleServicesClick_"
            role-description="$i18n{subpageArrowRoleDescription}"
            hidden="[[!shouldHideSyncSetupLinkRow_(syncStatus)]]">
        </cr-link-row>

        <template is="dom-if" if="[[signinAllowed_]]">
          <cr-link-row id="manage-google-account"
              label="$i18n{manageGoogleAccount}"
              hidden="[[!shouldShowGoogleAccount_]]"
              on-click="openGoogleAccount_" external></cr-link-row>

          <cr-link-row id="edit-profile"
              label="$i18n{profileNameAndPicture}"
              on-click="onProfileClick_" ></cr-link-row>
        </template>

        <cr-link-row id="importDataDialogTrigger"
            label="$i18n{importTitle}"
            on-click="onImportDataClick_"></cr-link-row>

        <template is="dom-if" if="[[isDasherlessProfile_]]">
          <div id="sync-not-allowed" class="cr-row continuation">
            <cr-icon id="info-icon" icon="cr:info-outline"></cr-icon>
            <div id="sync-not-allowed-text" class="flex cr-padded-text">
              $i18n{syncUnavailableForNonGoogleAccount}
            </div>
          </div>
        </template>




      </div>
    </settings-section>


    <template is="dom-if" if="[[showSignoutDialog_]]" restamp>
      <settings-signout-dialog sync-status="[[syncStatus]]"
          on-close="onDisconnectDialogClosed_">
      </settings-signout-dialog>
    </template>

    <template is="dom-if" if="[[showImportDataDialog_]]" restamp>
      <settings-import-data-dialog prefs="{{prefs}}"
          on-close="onImportDataDialogClosed_">
      </settings-import-data-dialog>
    </template>

    <cr-toast duration="3000" id="toast">
      <span>$i18n{syncSettingsSavedToast}</span>
    </cr-toast>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/people_page/people_page.js
var SettingsPeoplePageElementBase = SettingsViewMixin(RouteObserverMixin(WebUiListenerMixin(PolymerElement)));
var SettingsPeoplePageElement = class extends SettingsPeoplePageElementBase {
	static get is() {
		return "settings-people-page";
	}
	static get template() {
		return getTemplate$28();
	}
	static get properties() {
		return {
			/**
			* Preferences state.
			*/
			prefs: {
				type: Object,
				notify: true
			},
			/**
			* This flag is used to conditionally show a set of new sign-in UIs to the
			* profiles that have been migrated to be consistent with the web
			* sign-ins.
			* TODO(tangltom): In the future when all profiles are completely
			* migrated, this should be removed, and UIs hidden behind it should
			* become default.
			*/
			signinAllowed_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("signinAllowed");
				}
			},
			/**
			* This property stores whether the profile is a Dasherless profiles,
			* which is associated with a non-Dasher account. Some UIs related to
			* sign in and sync service will be different because they are not
			* available for these profiles.
			*/
			isDasherlessProfile_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("isDasherlessProfile");
				}
			},
			/**
			* Stored accounts to the system, supplied by SyncBrowserProxy.
			*/
			storedAccounts: Object,
			/**
			* The current sync status, supplied by SyncBrowserProxy.
			*/
			syncStatus: Object,
			/**
			* Authentication token provided by settings-lock-screen.
			*/
			authToken_: {
				type: String,
				value: ""
			},
			/**
			* The currently selected profile icon URL. May be a data URL.
			*/
			profileIconUrl_: String,
			/**
			* Whether the profile row is clickable. The behavior depends on the
			* platform.
			*/
			isProfileActionable_: {
				type: Boolean,
				value() {
					if (!isChromeOS) return true;
					return loadTimeData$1.getBoolean("isAccountManagerEnabled");
				},
				readOnly: true
			},
			/**
			* The current profile name.
			*/
			profileName_: String,
			shouldShowGoogleAccount_: {
				type: Boolean,
				value: false,
				computed: "computeShouldShowGoogleAccount_(storedAccounts, syncStatus,storedAccounts.length, syncStatus.signedIn, syncStatus.hasError)"
			},
			replaceSyncPromosWithSignInPromos_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("replaceSyncPromosWithSignInPromos")
			},
			showImportDataDialog_: {
				type: Boolean,
				value: false
			},
			showSignoutDialog_: Boolean,
			primaryAccountName_: String,
			primaryAccountEmail_: String,
			primaryAccountIconUrl_: String,
			accessPointEnum_: {
				type: Object,
				value: ChromeSigninAccessPoint
			}
		};
	}
	syncBrowserProxy_ = SyncBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		ProfileInfoBrowserProxyImpl.getInstance().getProfileInfo().then(this.handleProfileInfo_.bind(this));
		this.addWebUiListener("profile-info-changed", this.handleProfileInfo_.bind(this));
		this.syncBrowserProxy_.getSyncStatus().then(this.handleSyncStatus_.bind(this));
		this.addWebUiListener("sync-status-changed", this.handleSyncStatus_.bind(this));
		this.syncBrowserProxy_.getStoredAccounts().then(this.handleStoredAccounts_.bind(this));
		this.addWebUiListener("stored-accounts-updated", this.handleStoredAccounts_.bind(this));
		this.addWebUiListener("sync-settings-saved", () => {
			this.$.toast.show();
		});
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		this.showImportDataDialog_ = Router.getInstance().getCurrentRoute() === routes.IMPORT_DATA;
		if (Router.getInstance().getCurrentRoute() === routes.SIGN_OUT) {
			if (this.syncStatus && !this.isSyncing_()) Router.getInstance().navigateToPreviousRoute();
			else this.showSignoutDialog_ = true;
		}
	}
	/**
	* Handler for when the profile's icon and name is updated.
	*/
	handleProfileInfo_(info) {
		this.profileName_ = info.name;
		/**
		* Extract first frame from image by creating a single frame PNG using
		* url as input if base64 encoded and potentially animated.
		*/
		this.profileIconUrl_ = info.iconUrl;
	}
	/**
	* Handler for when the sync state is pushed from the browser.
	*/
	handleSyncStatus_(syncStatus) {
		const shouldRecordSigninImpression = !this.syncStatus && syncStatus && this.signinAllowed_ && !this.isSyncing_() && !this.replaceSyncPromosWithSignInPromos_;
		this.syncStatus = syncStatus;
		if (shouldRecordSigninImpression && !this.shouldShowSyncAccountControl_()) chrome.metricsPrivate.recordUserAction("Signin_Impression_FromSettings");
	}
	computeShouldShowGoogleAccount_() {
		if (this.storedAccounts === void 0 || this.syncStatus === void 0) return false;
		if (this.syncStatus.hasError && this.syncStatus.statusAction !== StatusAction.UPGRADE_CLIENT && this.syncStatus.statusAction !== StatusAction.SHOW_BOOKMARKS_LIMIT_HELP_ARTICLE) return false;
		return !this.replaceSyncPromosWithSignInPromos_ && this.storedAccounts.length > 0 || this.isSyncing_();
	}
	onProfileClick_() {
		Router.getInstance().navigateTo(routes.MANAGE_PROFILE);
	}
	onDisconnectDialogClosed_() {
		this.showSignoutDialog_ = false;
		if (Router.getInstance().getCurrentRoute() === routes.SIGN_OUT) Router.getInstance().navigateToPreviousRoute();
	}
	onSyncClick_() {
		Router.getInstance().navigateTo(routes.SYNC);
	}
	onAccountClick_() {
		Router.getInstance().navigateTo(routes.ACCOUNT);
	}
	onGoogleServicesClick_() {
		Router.getInstance().navigateTo(routes.GOOGLE_SERVICES);
	}
	onImportDataClick_() {
		Router.getInstance().navigateTo(routes.IMPORT_DATA);
	}
	onImportDataDialogClosed_() {
		Router.getInstance().navigateToPreviousRoute();
		focusWithoutInk(this.$.importDataDialogTrigger);
	}
	shouldLinkToAccountSettingsPage_() {
		return this.replaceSyncPromosWithSignInPromos_ && !!this.syncStatus && this.syncStatus.signedInState === SignedInState.SIGNED_IN;
	}
	shouldLinkToProfileRow_() {
		return !this.shouldShowSyncAccountControl_() && !this.shouldLinkToAccountSettingsPage_();
	}
	shouldShowSyncAccountControl_() {
		if (this.syncStatus === void 0) return false;
		return !!this.syncStatus.syncSystemEnabled && this.signinAllowed_ && !this.shouldLinkToAccountSettingsPage_();
	}
	handleStoredAccounts_(accounts) {
		this.storedAccounts = accounts;
		if (accounts.length === 0) return;
		this.primaryAccountName_ = accounts[0].fullName;
		this.primaryAccountEmail_ = accounts[0].email;
		this.primaryAccountIconUrl_ = accounts[0].avatarImage;
	}
	/**
	* Open URL for managing your Google Account.
	*/
	openGoogleAccount_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("googleAccountUrl"));
		chrome.metricsPrivate.recordUserAction("ManageGoogleAccount_Clicked");
	}
	/**
	* @return A CSS image-set for multiple scale factors.
	*/
	getIconImageSet_(iconUrl) {
		if (!iconUrl) return "";
		return getImage(iconUrl);
	}
	isSyncing_() {
		return !!this.syncStatus && this.syncStatus.signedInState === SignedInState.SYNCING;
	}
	shouldHideSyncSetupLinkRow_() {
		return this.replaceSyncPromosWithSignInPromos_ && (!this.syncStatus || this.syncStatus.signedInState !== SignedInState.SYNCING);
	}
	getAccountRowSubtitle_() {
		if (this.syncStatus && this.syncStatus.statusText) {
			if (this.syncStatus.statusAction === StatusAction.ENTER_PASSPHRASE) return loadTimeData$1.substituteString(this.syncStatus.statusText, this.primaryAccountEmail_);
			if (this.syncStatus.statusAction === StatusAction.SHOW_BOOKMARKS_LIMIT_HELP_ARTICLE) return this.syncStatus.statusText;
		}
		return this.primaryAccountEmail_;
	}
	getFocusConfig() {
		const map = /* @__PURE__ */ new Map();
		if (routes.SYNC) map.set(routes.SYNC.path, "#sync-setup");
		if (routes.MANAGE_PROFILE) map.set(routes.MANAGE_PROFILE.path, loadTimeData$1.getBoolean("signinAllowed") ? "#edit-profile" : "#profile-row .subpage-arrow");
		if (routes.ACCOUNT) map.set(routes.ACCOUNT.path, "#account-subpage-row");
		if (routes.GOOGLE_SERVICES) map.set(routes.GOOGLE_SERVICES.path, "#google-services");
		return map;
	}
	getAssociatedControlFor(childViewId) {
		assert([
			"sync",
			"syncControls",
			"manageProfile",
			"account",
			"googleServices"
		].includes(childViewId));
		let triggerId = null;
		switch (childViewId) {
			case "sync":
			case "syncControls":
				triggerId = "sync-setup";
				break;
			case "manageProfile":
				triggerId = this.signinAllowed_ ? "edit-profile" : "profile-row";
				break;
			case "account":
				assert(loadTimeData$1.getBoolean("replaceSyncPromosWithSignInPromos"));
				triggerId = "account-subpage-row";
				break;
			case "googleServices":
				assert(loadTimeData$1.getBoolean("replaceSyncPromosWithSignInPromos"));
				triggerId = "google-services";
				break;
			default: assertNotReached();
		}
		assert(triggerId);
		const control = this.shadowRoot.querySelector(`#${triggerId}`);
		assert(control);
		return control;
	}
};
customElements.define(SettingsPeoplePageElement.is, SettingsPeoplePageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/people_page/people_page_index.html.js
function getTemplate$27() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">
  <settings-people-page slot="view" id="parent" prefs="{{prefs}}"
      route-path$="[[routes_.PEOPLE.path]]">
  </settings-people-page>

  <settings-sync-page slot="view" id="sync"
      data-parent-view-id="parent" prefs="{{prefs}}"
      route-path$="[[routes_.SYNC.path]]">
  </settings-sync-page>

  <settings-sync-controls-page slot="view" id="syncControls"
      data-parent-view-id="parent" route-path$="[[routes_.SYNC_ADVANCED.path]]">
  </settings-sync-controls-page>


   <settings-manage-profile slot="view" id="manageProfile"
       data-parent-view-id="parent" profile-name="[[profileName_]]"
       route-path$="[[routes_.MANAGE_PROFILE.path]]">
   </settings-manage-profile>

   <template is="dom-if" if="[[replaceSyncPromosWithSignInPromos_]]"
      restamp>
     <settings-account-page slot="view" id="account"
         data-parent-view-id="parent" prefs="{{prefs}}"
         route-path$="[[routes_.ACCOUNT.path]]">
     </settings-account-page>

     <settings-google-services-page slot="view" id="googleServices"
         data-parent-view-id="parent" prefs="{{prefs}}"
         route-path$="[[routes_.GOOGLE_SERVICES.path]]">
     </settings-google-services-page>
   </template>

</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/people_page/people_page_index.js
var SettingsPeoplePageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(PolymerElement));
var SettingsPeoplePageIndexElement = class extends SettingsPeoplePageIndexElementBase {
	static get is() {
		return "settings-people-page-index";
	}
	static get template() {
		return getTemplate$27();
	}
	static get properties() {
		return {
			prefs: Object,
			routes_: {
				type: Object,
				value: () => routes
			},
			replaceSyncPromosWithSignInPromos_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("replaceSyncPromosWithSignInPromos")
			}
		};
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.PEOPLE:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.BASIC:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.SYNC:
					this.$.viewManager.switchView("sync", "no-animation", "no-animation");
					break;
				case routes.SYNC_ADVANCED:
					this.$.viewManager.switchView("syncControls", "no-animation", "no-animation");
					break;
				case routes.IMPORT_DATA:
				case routes.SIGN_OUT:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.ACCOUNT:
					assert(this.replaceSyncPromosWithSignInPromos_);
					this.$.viewManager.switchView("account", "no-animation", "no-animation");
					break;
				case routes.GOOGLE_SERVICES:
					assert(this.replaceSyncPromosWithSignInPromos_);
					this.$.viewManager.switchView("googleServices", "no-animation", "no-animation");
					break;
				case routes.MANAGE_PROFILE: this.$.viewManager.switchView("manageProfile", "no-animation", "no-animation");
			}
		});
	}
};
customElements.define(SettingsPeoplePageIndexElement.is, SettingsPeoplePageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/battery_page.html.js
function getTemplate$26() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">.battery-saver-radio-group{padding-block-end:var(--cr-section-vertical-padding)}</style>
<settings-section

    page-title="$i18n{batteryPageTitle}">
  <template is="dom-if" if="[[isBatterySaverModeManagedByOs_]]">
    <cr-link-row id="batterySaverOSSettingsLinkRow"
        label="$i18n{batterySaverModeLabel}"
        sub-label="$i18n{batterySaverModeLinkOsDescription}"
        on-click="openOsPowerSettings_"
        external>
    </cr-link-row>
  </template>
  <template is="dom-if" if="[[!isBatterySaverModeManagedByOs_]]">
    <settings-toggle-button id="toggleButton" on-change="onChange_"
        pref="{{prefs.performance_tuning.battery_saver_mode.state}}"
        label="$i18n{batterySaverModeLabel}"
        sub-label-with-link="$i18n{batterySaverModeDescription}"
        on-sub-label-link-clicked="onBatterySaverLearnMoreLinkClick_"
        numeric-unchecked-values="[[numericUncheckedValues_]]"
        numeric-checked-value="[[batterySaverModeStateEnum_.ENABLED_BELOW_THRESHOLD]]">
    </settings-toggle-button>
    <cr-collapse id="radioGroupCollapse"
        opened="[[isBatterySaverModeEnabled_(prefs.performance_tuning.battery_saver_mode.state.value)]]">
      <div class="cr-row continuation battery-saver-radio-group">
        <settings-radio-group id="radioGroup" on-change="onChange_"
            pref="{{prefs.performance_tuning.battery_saver_mode.state}}"
            group-aria-label="$i18n{batterySaverModeRadioGroupAriaLabel}">
          <controlled-radio-button
              label="$i18n{batterySaverModeEnabledBelowThresholdLabel}"
              name="[[batterySaverModeStateEnum_.ENABLED_BELOW_THRESHOLD]]"
              pref="[[prefs.performance_tuning.battery_saver_mode.state]]">
          </controlled-radio-button>
          <controlled-radio-button id="enabledOnBatteryButton"
              label="$i18n{batterySaverModeEnabledOnBatteryLabel}"
              name="[[batterySaverModeStateEnum_.ENABLED_ON_BATTERY]]"
              pref="[[prefs.performance_tuning.battery_saver_mode.state]]">
          </controlled-radio-button>
        </settings-radio-group>
      </div>
    </cr-collapse>
  </template>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/performance_metrics_proxy.js
var BatterySaverModeState;
(function(BatterySaverModeState) {
	BatterySaverModeState[BatterySaverModeState["DISABLED"] = 0] = "DISABLED";
	BatterySaverModeState[BatterySaverModeState["ENABLED_BELOW_THRESHOLD"] = 1] = "ENABLED_BELOW_THRESHOLD";
	BatterySaverModeState[BatterySaverModeState["ENABLED_ON_BATTERY"] = 2] = "ENABLED_ON_BATTERY";
	BatterySaverModeState[BatterySaverModeState["ENABLED"] = 3] = "ENABLED";
	BatterySaverModeState[BatterySaverModeState["COUNT"] = 4] = "COUNT";
})(BatterySaverModeState || (BatterySaverModeState = {}));
var MemorySaverModeAggressiveness;
(function(MemorySaverModeAggressiveness) {
	MemorySaverModeAggressiveness[MemorySaverModeAggressiveness["CONSERVATIVE"] = 0] = "CONSERVATIVE";
	MemorySaverModeAggressiveness[MemorySaverModeAggressiveness["MEDIUM"] = 1] = "MEDIUM";
	MemorySaverModeAggressiveness[MemorySaverModeAggressiveness["AGGRESSIVE"] = 2] = "AGGRESSIVE";
	MemorySaverModeAggressiveness[MemorySaverModeAggressiveness["COUNT"] = 3] = "COUNT";
})(MemorySaverModeAggressiveness || (MemorySaverModeAggressiveness = {}));
var MemorySaverModeExceptionListAction;
(function(MemorySaverModeExceptionListAction) {
	MemorySaverModeExceptionListAction[MemorySaverModeExceptionListAction["ADD_MANUAL"] = 0] = "ADD_MANUAL";
	MemorySaverModeExceptionListAction[MemorySaverModeExceptionListAction["EDIT"] = 1] = "EDIT";
	MemorySaverModeExceptionListAction[MemorySaverModeExceptionListAction["REMOVE"] = 2] = "REMOVE";
	MemorySaverModeExceptionListAction[MemorySaverModeExceptionListAction["ADD_FROM_CURRENT"] = 3] = "ADD_FROM_CURRENT";
	MemorySaverModeExceptionListAction[MemorySaverModeExceptionListAction["COUNT"] = 4] = "COUNT";
})(MemorySaverModeExceptionListAction || (MemorySaverModeExceptionListAction = {}));
var MemorySaverModeState;
(function(MemorySaverModeState) {
	MemorySaverModeState[MemorySaverModeState["DISABLED"] = 0] = "DISABLED";
	MemorySaverModeState[MemorySaverModeState["DEPRECATED"] = 1] = "DEPRECATED";
	MemorySaverModeState[MemorySaverModeState["ENABLED"] = 2] = "ENABLED";
	MemorySaverModeState[MemorySaverModeState["COUNT"] = 3] = "COUNT";
})(MemorySaverModeState || (MemorySaverModeState = {}));
var PerformanceMetricsProxyImpl = class PerformanceMetricsProxyImpl {
	recordBatterySaverModeChanged(state) {
		chrome.metricsPrivate.recordEnumerationValue("PerformanceControls.BatterySaver.SettingsChangeMode", state, BatterySaverModeState.COUNT);
	}
	recordMemorySaverModeChanged(state) {
		chrome.metricsPrivate.recordEnumerationValue("PerformanceControls.MemorySaver.SettingsChangeMode", state, MemorySaverModeState.COUNT);
	}
	recordMemorySaverModeAggressivenessChanged(aggressiveness) {
		chrome.metricsPrivate.recordEnumerationValue("PerformanceControls.MemorySaver.SettingsChangeAggressiveness", aggressiveness, MemorySaverModeAggressiveness.COUNT);
	}
	recordDiscardRingTreatmentEnabledChanged(enabled) {
		chrome.metricsPrivate.recordBoolean("PerformanceControls.MemorySaver.DiscardRingTreatment", enabled);
	}
	recordExceptionListAction(action) {
		chrome.metricsPrivate.recordEnumerationValue("PerformanceControls.MemorySaver.SettingsChangeExceptionList", action, MemorySaverModeExceptionListAction.COUNT);
	}
	recordPerformanceInterventionToggleButtonChanged(enabled) {
		chrome.metricsPrivate.recordBoolean("PerformanceControls.Intervention.SettingsChangeNotification", enabled);
	}
	static getInstance() {
		return instance$3 || (instance$3 = new PerformanceMetricsProxyImpl());
	}
	static setInstance(obj) {
		instance$3 = obj;
	}
};
var instance$3 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/battery_page.js
var BATTERY_SAVER_MODE_PREF = "performance_tuning.battery_saver_mode.state";
var SettingsBatteryPageElementBase = PrefsMixin(PolymerElement);
var SettingsBatteryPageElement = class extends SettingsBatteryPageElementBase {
	static get is() {
		return "settings-battery-page";
	}
	static get template() {
		return getTemplate$26();
	}
	static get properties() {
		return {
			batterySaverModeStateEnum_: {
				readOnly: true,
				type: Object,
				value: BatterySaverModeState
			},
			isBatterySaverModeManagedByOs_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("isBatterySaverModeManagedByOS");
				}
			},
			numericUncheckedValues_: {
				type: Array,
				value: () => [BatterySaverModeState.DISABLED]
			}
		};
	}
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	isBatterySaverModeEnabled_(value) {
		return value !== BatterySaverModeState.DISABLED;
	}
	onChange_() {
		this.metricsProxy_.recordBatterySaverModeChanged(this.getPref(BATTERY_SAVER_MODE_PREF).value);
	}
	onBatterySaverLearnMoreLinkClick_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("batterySaverLearnMoreUrl"));
	}
};
customElements.define(SettingsBatteryPageElement.is, SettingsBatteryPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/memory_page.html.js
function getTemplate$25() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">.memory-saver-radio-group{padding-block-end:var(--cr-section-vertical-padding)}</style>
<settings-section

    page-title="$i18n{memoryPageTitle}">
  <settings-toggle-button id="toggleButton" on-change="onMemorySaverModeChange_"
      pref="{{prefs.performance_tuning.high_efficiency_mode.state}}"
      label="$i18n{memorySaverModeLabel}"
      sub-label-with-link="$i18n{memorySaverModeDescription}"
      on-sub-label-link-clicked="onMemorySaverLearnMoreLinkClick_"
      numeric-unchecked-values="[[numericUncheckedValues_]]"
      numeric-checked-value="[[numericCheckedValue_]]">
  </settings-toggle-button>
  <cr-collapse id="radioGroupCollapse" opened="[[isMemorySaverModeEnabled_(
          prefs.performance_tuning.high_efficiency_mode.state.value)]]">
    <div class="cr-row continuation memory-saver-radio-group">
      <settings-radio-group id="radioGroup"
        on-change="onMemorySaverModeAggressivenessChange_" pref="{{
              prefs.performance_tuning.high_efficiency_mode.aggressiveness}}"
        group-aria-label="$i18n{memorySaverModeRadioGroupAriaLabel}">
        <controlled-radio-button id="conservativeButton"
          label="$i18n{memorySaverModeConservativeLabel}"
          name$="[[memorySaverModeAggressivenessEnum_.CONSERVATIVE]]" pref="[[
                prefs.performance_tuning.high_efficiency_mode.aggressiveness]]">
          <div class="cr-secondary-text">
            $i18n{memorySaverModeConservativeDescription}
          </div>
        </controlled-radio-button>
        <controlled-radio-button id="mediumButton"
          label="$i18n{memorySaverModeMediumLabel}"
          name$="[[memorySaverModeAggressivenessEnum_.MEDIUM]]" pref="[[
                prefs.performance_tuning.high_efficiency_mode.aggressiveness]]">
          <div class="cr-secondary-text">
            $i18n{memorySaverModeMediumDescription}
          </div>
        </controlled-radio-button>
        <controlled-radio-button id="aggressiveButton"
          label="$i18n{memorySaverModeAggressiveLabel}"
          name$="[[memorySaverModeAggressivenessEnum_.AGGRESSIVE]]" pref="[[
                prefs.performance_tuning.high_efficiency_mode.aggressiveness]]">
          <div class="cr-secondary-text">
            $i18n{memorySaverModeAggressiveDescription}
          </div>
        </controlled-radio-button>
      </settings-radio-group>
    </div>
  </cr-collapse>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/memory_page.js
var MEMORY_SAVER_MODE_PREF = "performance_tuning.high_efficiency_mode.state";
var MEMORY_SAVER_MODE_AGGRESSIVENESS_PREF = "performance_tuning.high_efficiency_mode.aggressiveness";
var SettingsMemoryPageElementBase = PrefsMixin(PolymerElement);
var SettingsMemoryPageElement = class extends SettingsMemoryPageElementBase {
	static get is() {
		return "settings-memory-page";
	}
	static get template() {
		return getTemplate$25();
	}
	static get properties() {
		return {
			memorySaverModeAggressivenessEnum_: {
				readOnly: true,
				type: Object,
				value: MemorySaverModeAggressiveness
			},
			numericUncheckedValues_: {
				type: Array,
				value: () => [MemorySaverModeState.DISABLED]
			},
			numericCheckedValue_: {
				type: Number,
				value: () => MemorySaverModeState.ENABLED
			}
		};
	}
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	onMemorySaverModeChange_() {
		this.metricsProxy_.recordMemorySaverModeChanged(this.getPref(MEMORY_SAVER_MODE_PREF).value);
	}
	onMemorySaverModeAggressivenessChange_() {
		this.metricsProxy_.recordMemorySaverModeAggressivenessChanged(this.getPref(MEMORY_SAVER_MODE_AGGRESSIVENESS_PREF).value);
	}
	isMemorySaverModeEnabled_(value) {
		return value !== MemorySaverModeState.DISABLED;
	}
	onMemorySaverLearnMoreLinkClick_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("memorySaverLearnMoreUrl"));
	}
};
customElements.define(SettingsMemoryPageElement.is, SettingsMemoryPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/time.js
var WINDOWS_EPOCH = Date.UTC(1601, 0, 1, 0, 0, 0, 0);
var UNIX_EPOCH = Date.UTC(1970, 0, 1, 0, 0, 0, 0);
/**
* Converts a JavaScript Date() object to a string that represents microseconds
* since the Windows FILETIME epoch.
*
* The JS Date() is based off of the number of milliseconds since the UNIX epoch
* (1970-01-01 00::00:00 UTC), while times stored within prefs are represented
* as the number of microseconds since the Windows FILETIME epoch
* (1601-01-01 00:00:00 UTC).
*/
function convertDateToWindowsEpoch(date = Date.now()) {
	return `${(date + (UNIX_EPOCH - WINDOWS_EPOCH)) * 1e3}`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_edit_input.html.js
function getTemplate$24() {
	return Ke`<!--_html_template_start_--><cr-input id="input" label="$i18n{addSite}" aria-label="$i18n{editSiteTitle}"
    placeholder="example.com" value="{{rule}}" on-input="validate"
    error-message="[[errorMessage]]" invalid="[[inputInvalid]]"
    spellcheck="false" autofocus>
</cr-input>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/performance_browser_proxy.js
var PerformanceFeedbackCategory;
(function(PerformanceFeedbackCategory) {
	PerformanceFeedbackCategory["NOTIFICATIONS"] = "performance_notifications";
	PerformanceFeedbackCategory["TABS"] = "performance_tabs";
	PerformanceFeedbackCategory["BATTERY"] = "performance_battery";
	PerformanceFeedbackCategory["SPEED"] = "performance_speed";
})(PerformanceFeedbackCategory || (PerformanceFeedbackCategory = {}));
var PerformanceBrowserProxyImpl = class PerformanceBrowserProxyImpl {
	getCurrentOpenSites() {
		return sendWithPromise("getCurrentOpenSites");
	}
	getDeviceHasBattery() {
		return sendWithPromise("getDeviceHasBattery");
	}
	openFeedbackDialog(categoryTag) {
		chrome.send("openPerformanceFeedbackDialog", [categoryTag]);
	}
	validateTabDiscardExceptionRule(rule) {
		return sendWithPromise("validateTabDiscardExceptionRule", rule);
	}
	static getInstance() {
		return instance$2 || (instance$2 = new PerformanceBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$2 = obj;
	}
};
var instance$2 = null;
var TAB_DISCARD_EXCEPTIONS_PREF = "performance_tuning.tab_discarding.exceptions_with_time";
var TAB_DISCARD_EXCEPTIONS_MANAGED_PREF = "performance_tuning.tab_discarding.exceptions_managed";
var ExceptionValidationMixin = dedupingMixin((superClass) => {
	const superClassBase = I18nMixin(superClass);
	class ExceptionValidationMixin extends superClassBase {
		static get properties() {
			return {
				errorMessage: {
					type: String,
					value: ""
				},
				inputInvalid: {
					type: Boolean,
					value: false
				},
				rule: String,
				submitDisabled: {
					type: Boolean,
					value: true,
					notify: true
				}
			};
		}
		browserProxy_ = PerformanceBrowserProxyImpl.getInstance();
		validate() {
			const rule = this.rule.trim();
			if (!rule) {
				this.inputInvalid = false;
				this.submitDisabled = true;
				this.errorMessage = "";
				return;
			}
			if (rule.length > 10240) {
				this.inputInvalid = true;
				this.submitDisabled = true;
				this.errorMessage = this.i18n("onStartupUrlTooLong");
				return;
			}
			this.browserProxy_.validateTabDiscardExceptionRule(rule).then((valid) => {
				this.inputInvalid = !valid;
				this.submitDisabled = !valid;
				this.errorMessage = valid ? "" : this.i18n("onStartupInvalidUrl");
			});
		}
	}
	return ExceptionValidationMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_edit_input.js
var ExceptionEditInputElementBase = ExceptionValidationMixin(ListPropertyUpdateMixin(PrefsMixin(PolymerElement)));
var ExceptionEditInputElement = class extends ExceptionEditInputElementBase {
	static get is() {
		return "tab-discard-exception-edit-input";
	}
	static get template() {
		return getTemplate$24();
	}
	static get properties() {
		return { 
		/**
		* Represents the original rule that is being edited. When submit() is
		* called, it will be replaced by rule in the exception list.
		*/
ruleToEdit: {
			type: String,
			value: ""
		} };
	}
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	ready() {
		super.ready();
		this.rule = this.ruleToEdit;
		this.submitDisabled = false;
	}
	submit() {
		assert(!this.submitDisabled);
		const rule = this.rule.trim();
		if (rule !== this.ruleToEdit) {
			this.deletePrefDictEntry(TAB_DISCARD_EXCEPTIONS_PREF, this.ruleToEdit);
			this.setPrefDictEntry(TAB_DISCARD_EXCEPTIONS_PREF, rule, convertDateToWindowsEpoch());
		}
		this.metricsProxy_.recordExceptionListAction(MemorySaverModeExceptionListAction.EDIT);
	}
	setRuleToEditForTesting() {
		this.rule = this.ruleToEdit;
	}
};
customElements.define(ExceptionEditInputElement.is, ExceptionEditInputElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_edit_dialog.html.js
function getTemplate$23() {
	return Ke`<!--_html_template_start_--><cr-dialog id="dialog" close-text="$i18n{close}" show-on-attach>
  <div slot="title">$i18n{editSiteTitle}</div>
  <div slot="body">
    <tab-discard-exception-edit-input id="input" prefs="{{prefs}}"
        rule-to-edit="[[ruleToEdit]]"
        submit-disabled="{{submitDisabled}}">
    </tab-discard-exception-edit-input>
  </div>
  <div slot="button-container">
    <cr-button id="cancelButton" class="cancel-button"
        on-click="onCancelClick_">
      $i18n{cancel}
    </cr-button>
    <cr-button id="actionButton" class="action-button" on-click="onSubmitClick_"
        disabled$="[[submitDisabled]]"
        aria-label="$i18n{tabDiscardingExceptionsSaveButtonAriaLabel}">
      $i18n{save}
    </cr-button>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_edit_dialog.js
var ExceptionEditDialogElementBase = PrefsMixin(PolymerElement);
var ExceptionEditDialogElement = class extends ExceptionEditDialogElementBase {
	static get is() {
		return "tab-discard-exception-edit-dialog";
	}
	static get template() {
		return getTemplate$23();
	}
	static get properties() {
		return { ruleToEdit: {
			type: String,
			value: ""
		} };
	}
	onCancelClick_() {
		this.$.dialog.cancel();
	}
	onSubmitClick_() {
		this.$.dialog.close();
		this.$.input.submit();
	}
	setRuleToEditForTesting(rule) {
		this.ruleToEdit = rule;
		this.$.input.setRuleToEditForTesting();
	}
};
customElements.define(ExceptionEditDialogElement.is, ExceptionEditDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_entry.html.js
function getTemplate$22() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-policy-pref-indicator::part(tooltip){clip:rect(0 0 0 0);height:1px;overflow:hidden;width:1px}cr-policy-pref-indicator{padding-inline-end:8px}</style>
<div class="list-item">
  <div class="start text-elide">[[entry.site]]</div>
  <template is="dom-if" if="[[entry.managed]]">
    <cr-policy-pref-indicator
        pref="[[prefs.performance_tuning.tab_discarding.exceptions_managed]]"
        on-mouseenter="onShowTooltip_" on-focus="onShowTooltip_">
    </cr-policy-pref-indicator>
  </template>
  <template is="dom-if" if="[[!entry.managed]]">
    <cr-icon-button class="icon-more-vert" title="$i18n{moreActions}"
        on-click="onMenuClick_" aria-label="$i18n{moreActions}">
    </cr-icon-button>
  </template>
</div><!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_entry.js
var ExceptionEntryElementBase = BaseMixin(PolymerElement);
var ExceptionEntryElement = class extends ExceptionEntryElementBase {
	static get is() {
		return "tab-discard-exception-entry";
	}
	static get template() {
		return getTemplate$22();
	}
	static get properties() {
		return {
			entry: Object,
			prefs: Object
		};
	}
	onMenuClick_(e) {
		this.fire("menu-click", {
			target: e.target,
			site: this.entry.site
		});
	}
	onShowTooltip_() {
		const indicator = this.shadowRoot.querySelector("cr-policy-pref-indicator");
		assert(!!indicator);
		this.fire("show-tooltip", {
			target: indicator,
			text: indicator.indicatorTooltip
		});
	}
};
customElements.define(ExceptionEntryElement.is, ExceptionEntryElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_add_input.html.js
function getTemplate$21() {
	return Ke`<!--_html_template_start_--><cr-input id="input" label="$i18n{addSite}" aria-label="$i18n{addSiteTitle}"
    placeholder="example.com" value="{{rule}}" on-input="validate"
    error-message="[[errorMessage]]" invalid="[[inputInvalid]]"
    spellcheck="false" autofocus>
</cr-input>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_add_input.js
var ExceptionAddInputElementBase = ExceptionValidationMixin(ListPropertyUpdateMixin(PrefsMixin(PolymerElement)));
var ExceptionAddInputElement = class extends ExceptionAddInputElementBase {
	static get is() {
		return "tab-discard-exception-add-input";
	}
	static get template() {
		return getTemplate$21();
	}
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	submit() {
		assert(!this.submitDisabled);
		const rule = this.rule.trim();
		this.setPrefDictEntry(TAB_DISCARD_EXCEPTIONS_PREF, rule, convertDateToWindowsEpoch());
		this.metricsProxy_.recordExceptionListAction(MemorySaverModeExceptionListAction.ADD_MANUAL);
	}
};
customElements.define(ExceptionAddInputElement.is, ExceptionAddInputElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_current_sites_list.html.js
function getTemplate$20() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">#container{height:calc(5 * var(--cr-section-min-height))}#emptyText{padding-inline-end:20px;padding-inline-start:20px;padding-top:20px}.label-slot{align-items:center;display:flex}.checkbox-label{margin-inline-start:10px}</style>
<div id="container" scrollable>
  <iron-list id="list" scroll-target="container" role="listbox"
      items="[[currentSites_]]" hidden$="[[!currentSites_.length]]">
    <template>
      <settings-checkbox-list-entry role="option"
          checked="[[isSelectedSite_(item)]]" tabindex="[[tabIndex]]"
          aria-posinset$="[[getAriaPosinset_(index)]]"
          aria-setsize$="[[currentSites_.length]]"
          aria-description="$i18n{tabDiscardingExceptionsActiveSiteAriaDescription}"
          on-change="onToggleSelection_">
        <div class="label-slot">
          <site-favicon url="[[item]]"></site-favicon>
          <div class="checkbox-label text-elide">[[item]]</div>
        </div>
      </settings-checkbox-list-entry>
    </template>
  </iron-list>
  <div id="emptyText" hidden="[[currentSites_.length]]">
    $i18n{tabDiscardingExceptionsAddDialogCurrentTabsEmpty}
  </div>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_current_sites_list.js
var ExceptionCurrentSitesListElementBase = ListPropertyUpdateMixin(ScrollableMixin(PrefsMixin(PolymerElement)));
var ExceptionCurrentSitesListElement = class extends ExceptionCurrentSitesListElementBase {
	static get is() {
		return "tab-discard-exception-current-sites-list";
	}
	static get template() {
		return getTemplate$20();
	}
	static get properties() {
		return {
			currentSites_: {
				type: Array,
				value: []
			},
			selectedSites_: {
				type: Array,
				value() {
					return /* @__PURE__ */ new Set();
				}
			},
			submitDisabled: {
				type: Boolean,
				notify: true
			},
			updateIntervalMS_: {
				type: Number,
				value: 1e3
			},
			visible: {
				type: Boolean,
				value: true,
				observer: "onVisibilityChanged_"
			}
		};
	}
	browserProxy_ = PerformanceBrowserProxyImpl.getInstance();
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	onVisibilityChangedListener_;
	updateIntervalID_ = void 0;
	async connectedCallback() {
		super.connectedCallback();
		await this.updateCurrentSites_();
		this.dispatchEvent(new CustomEvent("sites-populated", { detail: { length: this.currentSites_.length } }));
		this.onVisibilityChanged_();
		this.onVisibilityChangedListener_ = this.onVisibilityChanged_.bind(this);
		document.addEventListener("visibilitychange", this.onVisibilityChangedListener_);
	}
	disconnectedCallback() {
		document.removeEventListener("visibilitychange", this.onVisibilityChangedListener_);
		this.stopUpdatingCurrentSites_();
	}
	notifyResize() {
		this.$.list.notifyResize();
	}
	onVisibilityChanged_() {
		if (this.visible && document.visibilityState === "visible") this.startUpdatingCurrentSites_();
		else this.stopUpdatingCurrentSites_();
	}
	startUpdatingCurrentSites_() {
		this.updateCurrentSites_().then(() => {
			if (this.updateIntervalID_ === void 0) this.updateIntervalID_ = setInterval(this.updateCurrentSites_.bind(this), this.updateIntervalMS_);
		});
	}
	stopUpdatingCurrentSites_() {
		if (this.updateIntervalID_ !== void 0) {
			clearInterval(this.updateIntervalID_);
			this.updateIntervalID_ = void 0;
		}
	}
	setUpdateIntervalForTesting(updateIntervalMS) {
		this.updateIntervalMS_ = updateIntervalMS;
		this.stopUpdatingCurrentSites_();
		this.startUpdatingCurrentSites_();
	}
	getIsUpdatingForTesting() {
		return this.updateIntervalID_ !== void 0;
	}
	async updateCurrentSites_() {
		const existingSites = new Set(Object.keys(this.getPref(TAB_DISCARD_EXCEPTIONS_PREF).value));
		const currentSites = (await this.browserProxy_.getCurrentOpenSites()).filter((rule) => !existingSites.has(rule));
		this.selectedSites_ = new Set(currentSites.filter(this.isSelectedSite_.bind(this)));
		this.computeSubmitDisabled_();
		this.updateList("currentSites_", (x) => x, currentSites);
		if (this.currentSites_.length) this.updateScrollableContents();
	}
	computeSubmitDisabled_() {
		this.submitDisabled = !this.selectedSites_.size;
	}
	getAriaPosinset_(index) {
		return index + 1;
	}
	isSelectedSite_(site) {
		return this.selectedSites_.has(site);
	}
	onToggleSelection_(e) {
		if (e.detail) this.selectedSites_.add(e.model.item);
		else this.selectedSites_.delete(e.model.item);
		this.computeSubmitDisabled_();
	}
	submit() {
		assert(!this.submitDisabled);
		this.selectedSites_.forEach((rule) => {
			this.setPrefDictEntry(TAB_DISCARD_EXCEPTIONS_PREF, rule, convertDateToWindowsEpoch());
		});
		this.metricsProxy_.recordExceptionListAction(MemorySaverModeExceptionListAction.ADD_FROM_CURRENT);
	}
};
customElements.define(ExceptionCurrentSitesListElement.is, ExceptionCurrentSitesListElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_tabbed_add_dialog.html.js
function getTemplate$19() {
	return Ke`<!--_html_template_start_--><style>cr-tabs{--cr-tabs-font-size:100%;--cr-tabs-height:40px}#dialog{--border-top-color:var(--google-grey-300);--cr-dialog-body-border-top:1px solid var(--border-top-color)}@media (prefers-color-scheme:dark){#dialog{--border-top-color:var(--cr-separator-color)}}#dialog::part(wrapper){overflow:hidden}#dialog [slot=title]{padding-bottom:8px}#dialog::part(body-container){height:calc(5 * var(--cr-section-min-height) + 2px)}#body{padding-inline-end:0;padding-inline-start:0}#helpText{padding-bottom:20px}#helpText>a{color:var(--cr-link-color)}#inputPage{padding-inline-end:20px;padding-inline-start:20px;padding-top:20px}</style>
<cr-dialog id="dialog" close-text="$i18n{close}">
  <div slot="title">$i18n{addSitesTitle}</div>
  <div slot="header">
    <cr-tabs id="tabs" tab-names="[[tabNames_]]" selected="{{selectedTab_}}">
    </cr-tabs>
  </div>
  <div id="body" slot="body">
    <cr-page-selector selected="[[selectedTab_]]"
        on-iron-select="onSelectedTabChanged_">
      <tab-discard-exception-current-sites-list id="list" prefs="{{prefs}}"
          on-sites-populated="onSitesPopulated_"
          visible="[[isAddCurrentSitesTabSelected_(selectedTab_)]]"
          submit-disabled="{{submitDisabledList_}}">
      </tab-discard-exception-current-sites-list>
      <div id="inputPage">
        <div id="helpText">
          $i18nRaw{tabDiscardingExceptionsAddDialogHelp}
        </div>
        <tab-discard-exception-add-input id="input" prefs="{{prefs}}"
            submit-disabled="{{submitDisabledManual_}}">
        </tab-discard-exception-add-input>
      </div>
    </cr-page-selector>
  </div>
  <div slot="button-container">
    <cr-button id="cancelButton" class="cancel-button"
        on-click="onCancelClick_">
      $i18n{cancel}
    </cr-button>
    <cr-button id="actionButton" class="action-button" on-click="onSubmitClick_"
        disabled$="[[isSubmitDisabled_(
            submitDisabledList_, submitDisabledManual_, selectedTab_)]]"
        aria-label="$i18n{tabDiscardingExceptionsAddButtonAriaLabel}">
      $i18n{add}
    </cr-button>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_tabbed_add_dialog.js
var ExceptionAddDialogTabs;
(function(ExceptionAddDialogTabs) {
	ExceptionAddDialogTabs[ExceptionAddDialogTabs["CURRENT_SITES"] = 0] = "CURRENT_SITES";
	ExceptionAddDialogTabs[ExceptionAddDialogTabs["MANUAL"] = 1] = "MANUAL";
})(ExceptionAddDialogTabs || (ExceptionAddDialogTabs = {}));
var ExceptionTabbedAddDialogElementBase = PrefsMixin(PolymerElement);
var ExceptionTabbedAddDialogElement = class extends ExceptionTabbedAddDialogElementBase {
	static get is() {
		return "tab-discard-exception-tabbed-add-dialog";
	}
	static get template() {
		return getTemplate$19();
	}
	static get properties() {
		return {
			selectedTab_: {
				type: Number,
				value: NONE_SELECTED
			},
			tabNames_: {
				type: Array,
				value: [loadTimeData$1.getString("tabDiscardingExceptionsAddDialogCurrentTabs"), loadTimeData$1.getString("tabDiscardingExceptionsAddDialogManual")]
			},
			submitDisabledList_: Boolean,
			submitDisabledManual_: Boolean
		};
	}
	onSelectedTabChanged_() {
		setTimeout(() => this.$.list.notifyResize(), 0);
	}
	onSitesPopulated_(e) {
		if (e.detail.length > 0) this.selectedTab_ = ExceptionAddDialogTabs.CURRENT_SITES;
		else if (this.selectedTab_ === NONE_SELECTED) this.selectedTab_ = ExceptionAddDialogTabs.MANUAL;
		this.$.dialog.showModal();
	}
	isAddCurrentSitesTabSelected_() {
		return this.selectedTab_ === ExceptionAddDialogTabs.CURRENT_SITES;
	}
	onCancelClick_() {
		this.$.dialog.cancel();
	}
	onSubmitClick_() {
		this.$.dialog.close();
		if (this.isAddCurrentSitesTabSelected_()) this.$.list.submit();
		else this.$.input.submit();
	}
	isSubmitDisabled_() {
		if (this.isAddCurrentSitesTabSelected_()) return this.submitDisabledList_;
		return this.submitDisabledManual_;
	}
};
customElements.define(ExceptionTabbedAddDialogElement.is, ExceptionTabbedAddDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/tab_discard/exception_list.html.js
function getTemplate$18() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">.cr-padded-text{flex:1}.list-frame{padding-inline-start:var(--cr-section-indent-width)}#outer{display:flex;flex-direction:column}#outer>tab-discard-exception-entry:not(:first-of-type){border-top:var(--cr-separator-line)}#expandButton{padding-inline-end:0;padding-inline-start:0;--cr-icon-button-margin-end:0}</style>
<div class="cr-row continuation">
  <div class="cr-padded-text">
    $i18n{tabDiscardingExceptionsHeader}
    <div class="secondary">$i18n{tabDiscardingExceptionsDescription}</div>
  </div>
  <cr-button id="addButton" on-click="onAddClick_"
      aria-label="$i18n{tabDiscardingExceptionsAddButtonAriaLabel}">
    $i18n{add}
  </cr-button>
</div>
<div id="noSitesAdded" class="list-frame" hidden$="[[hasSites_(siteList_.*)]]">
  <div class="list-item secondary">$i18n{noSitesAdded}</div>
</div>
<div id="outer" class="list-frame" role="list"
    hidden$="[[!hasSites_(siteList_.*)]]">
  <template is="dom-repeat" id="list" items="[[getSiteList_(siteList_.*)]]">
    <tab-discard-exception-entry prefs="[[prefs]]" entry="[[item]]"
        role="listitem"
        on-menu-click="onMenuClick_" on-show-tooltip="onShowTooltip_">
    </tab-discard-exception-entry>
  </template>
  <cr-expand-button id="expandButton" no-hover class="hr"
      hidden$="[[!hasOverflowSites_(siteList_.*)]]"
      expanded="{{overflowSiteListExpanded}}">
    <div>$i18n{tabDiscardingExceptionsAdditionalSites}</div>
  </cr-expand-button>
  <cr-collapse id="collapse" hidden$="[[!hasOverflowSites_(siteList_.*)]]"
      opened="[[overflowSiteListExpanded]]">
    <template is="dom-repeat" id="overflowList"
        items="[[getOverflowSiteList_(siteList_.*)]]">
      <div class="hr">
        <tab-discard-exception-entry prefs="[[prefs]]" entry="[[item]]"
            role="listitem"
            on-menu-click="onMenuClick_" on-show-tooltip="onShowTooltip_">
        </tab-discard-exception-entry>
      </div>
    </template>
  </cr-collapse>
</div>
<cr-tooltip id="tooltip"
    fit-to-visible-bounds manual-mode position="top">
  [[tooltipText_]]
</cr-tooltip>
<cr-lazy-render id="menu">
  <template>
    <cr-action-menu role-description="$i18n{menu}">
      <button id="edit" class="dropdown-item" role="menuitem"
          on-click="onEditClick_">
        $i18n{edit}
      </button>
      <button id="delete" class="dropdown-item" role="menuitem"
          on-click="onDeleteClick_">
        $i18n{siteSettingsActionReset}
      </button>
    </cr-action-menu>
  </template>
</cr-lazy-render>
<template is="dom-if" if="[[showTabbedAddDialog_]]" restamp>
  <tab-discard-exception-tabbed-add-dialog prefs="{{prefs}}"
      on-close="onTabbedAddDialogClose_">
  </tab-discard-exception-tabbed-add-dialog>
</template>
<template is="dom-if" if="[[showEditDialog_]]" restamp>
  <tab-discard-exception-edit-dialog prefs="{{prefs}}"
      on-close="onEditDialogClose_" rule-to-edit="[[selectedRule_]]">
  </tab-discard-exception-edit-dialog>
</template>
<!--_html_template_end_-->`;
}
var ExceptionListElementBase = TooltipMixin(ListPropertyUpdateMixin(PrefsMixin(PolymerElement)));
var ExceptionListElement = class extends ExceptionListElementBase {
	static get is() {
		return "tab-discard-exception-list";
	}
	static get template() {
		return getTemplate$18();
	}
	static get properties() {
		return {
			siteList_: {
				type: Array,
				value: []
			},
			overflowSiteListExpanded: {
				type: Boolean,
				value: false
			},
			/**
			* Rule corresponding to the last more actions menu opened. Indicates to
			* this element and its dialog which rule to edit or if a new one should
			* be added.
			*/
			selectedRule_: {
				type: String,
				value: ""
			},
			showTabbedAddDialog_: {
				type: Boolean,
				value: false
			},
			showEditDialog_: {
				type: Boolean,
				value: false
			},
			tooltipText_: String
		};
	}
	static get observers() {
		return [`onPrefsChanged_(prefs.${TAB_DISCARD_EXCEPTIONS_PREF}.value.*,prefs.${TAB_DISCARD_EXCEPTIONS_MANAGED_PREF}.value.*)`];
	}
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	hasSites_() {
		return this.siteList_.length > 0;
	}
	hasOverflowSites_() {
		return this.siteList_.length > 5;
	}
	getSiteList_() {
		return this.siteList_.slice(-5).reverse();
	}
	getOverflowSiteList_() {
		return this.siteList_.slice(0, -5).reverse();
	}
	onAddClick_() {
		assert(!this.showEditDialog_);
		this.showTabbedAddDialog_ = true;
	}
	onMenuClick_(e) {
		e.stopPropagation();
		this.selectedRule_ = e.detail.site;
		this.$.menu.get().showAt(e.detail.target);
	}
	onEditClick_() {
		assert(this.selectedRule_);
		assert(!this.showTabbedAddDialog_);
		this.showEditDialog_ = true;
		this.$.menu.get().close();
	}
	onDeleteClick_() {
		this.deletePrefDictEntry(TAB_DISCARD_EXCEPTIONS_PREF, this.selectedRule_);
		this.metricsProxy_.recordExceptionListAction(MemorySaverModeExceptionListAction.REMOVE);
		this.$.menu.get().close();
	}
	onTabbedAddDialogClose_() {
		this.showTabbedAddDialog_ = false;
	}
	onEditDialogClose_() {
		this.showEditDialog_ = false;
	}
	onPrefsChanged_() {
		const newSites = [];
		for (const pref of [TAB_DISCARD_EXCEPTIONS_MANAGED_PREF, TAB_DISCARD_EXCEPTIONS_PREF]) {
			const prefObject = this.getPref(pref);
			let sites = prefObject.value;
			if (sites.constructor.name === "Object") sites = Object.keys(sites);
			const siteToExceptionEntry = (site) => ({
				site,
				managed: prefObject.enforcement === chrome.settingsPrivate.Enforcement.ENFORCED
			});
			newSites.push(...sites.map(siteToExceptionEntry));
		}
		this.updateList("siteList_", (entry) => entry.site, newSites);
	}
	/**
	* Need to use common tooltip since the tooltip in the entry is cut off from
	* the iron-list.
	*/
	onShowTooltip_(e) {
		this.tooltipText_ = e.detail.text;
		this.showTooltipAtTarget(this.$.tooltip, e.detail.target);
	}
};
customElements.define(ExceptionListElement.is, ExceptionListElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/performance_page.html.js
function getTemplate$17() {
	return Ke`<!--_html_template_start_--><settings-section

    page-title="$i18n{generalPageTitle}">
  <settings-toggle-button id="performanceInterventionToggleButton"
    on-change="onPerformanceInterventionToggleButtonChange_"
    pref="{{prefs.performance_tuning.intervention_notification.enabled}}"
    label="$i18n{performanceInterventionEnabledLabel}"
    sub-label-with-link="$i18n{performanceInterventionEnabledDescription}"
    on-sub-label-link-clicked="onPerformanceInterventionLearnMoreLinkClick_">
  </settings-toggle-button>
  <settings-toggle-button id="discardRingTreatmentToggleButton"
    on-change="onDiscardRingChange_"
    pref="{{prefs.performance_tuning.discard_ring_treatment.enabled}}"
    label="$i18n{discardRingTreatmentEnabledLabel}"
    sub-label-with-link="
          $i18n{discardRingTreatmentEnabledDescriptionWithLearnLink}"
    on-sub-label-link-clicked="onDiscardRingTreatmentLearnMoreLinkClick_">
  </settings-toggle-button>
  <cr-link-row
      label="$i18n{tabHoverPreviewCardLinkTitle}"
      sub-label="$i18n{tabHoverPreviewCardLinkSubtitle}"
      on-click="onTabHoverPreviewCardLinkClick_" external>
  </cr-link-row>
  <tab-discard-exception-list id="exceptionList" prefs="{{prefs}}">
  </tab-discard-exception-list>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/performance_page.js
var DISCARD_RING_PREF = "performance_tuning.discard_ring_treatment.enabled";
var PERFORMANCE_INTERVENTION_NOTIFICATION_PREF = "performance_tuning.intervention_notification.enabled";
var INACTIVE_TAB_SETTING_ELEMENT_ID = "kInactiveTabSettingElementId";
var SettingsPerformancePageElementBase = HelpBubbleMixin(PrefsMixin(PolymerElement));
var SettingsPerformancePageElement = class extends SettingsPerformancePageElementBase {
	static get is() {
		return "settings-performance-page";
	}
	static get template() {
		return getTemplate$17();
	}
	metricsProxy_ = PerformanceMetricsProxyImpl.getInstance();
	ready() {
		super.ready();
		afterNextRender(this, () => {
			const discardRingTreatmentToggleButton = this.shadowRoot.querySelector("#discardRingTreatmentToggleButton");
			if (discardRingTreatmentToggleButton) this.registerHelpBubble(INACTIVE_TAB_SETTING_ELEMENT_ID, discardRingTreatmentToggleButton.getBubbleAnchor());
		});
	}
	onDiscardRingChange_() {
		this.metricsProxy_.recordDiscardRingTreatmentEnabledChanged(this.getPref(DISCARD_RING_PREF).value);
	}
	onDiscardRingTreatmentLearnMoreLinkClick_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("discardRingTreatmentLearnMoreUrl"));
	}
	onPerformanceInterventionLearnMoreLinkClick_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("performanceInterventionLearnMoreUrl"));
	}
	onTabHoverPreviewCardLinkClick_() {
		Router.getInstance().navigateTo(routes.APPEARANCE);
	}
	onPerformanceInterventionToggleButtonChange_() {
		this.metricsProxy_.recordPerformanceInterventionToggleButtonChanged(this.getPref(PERFORMANCE_INTERVENTION_NOTIFICATION_PREF).value);
	}
};
customElements.define(SettingsPerformancePageElement.is, SettingsPerformancePageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/speed_page.html.js
function getTemplate$16() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared settings-columned-section">.settings-section-bottom-padding{padding-block-end:var(--cr-section-vertical-padding)}settings-collapse-radio-button[hidden]+settings-collapse-radio-button{--settings-collapse-separator-line:0}settings-collapse-radio-button:not(:first-of-type){--settings-collapse-separator-line:var(--cr-separator-line)}</style>
<settings-section

    page-title="$i18n{speedPageTitle}">

  <settings-toggle-button id="preloadingToggle"
      pref="{{prefs.net.network_prediction_options}}"
      label="$i18n{preloadingPageTitle}"
      sub-label-with-link="$i18n{preloadingToggleSummary}"
      on-sub-label-link-clicked="onPreloadingLearnMoreLinkClick_"
      numeric-unchecked-values="[[numericUncheckedValues_]]"
      numeric-checked-value="[[networkPredictionOptionsEnum_.STANDARD]]"
      on-change="onPreloadingStateChange_">
  </settings-toggle-button>
  <cr-collapse
      opened="[[isPreloadingEnabled_(
          prefs.net.network_prediction_options.value)]]">
    <div class="cr-row continuation settings-section-bottom-padding">
      <settings-radio-group id="preloadingRadioGroup"
          pref="{{prefs.net.network_prediction_options}}"
          selectable-elements="settings-collapse-radio-button"
          on-change="onPreloadingStateChange_">
        <settings-collapse-radio-button id="preloadingExtended"
            name="[[networkPredictionOptionsEnum_.EXTENDED]]"
            pref="[[prefs.net.network_prediction_options]]"
            label="$i18n{preloadingPageExtendedPreloadingTitle}"
            sub-label="$i18n{preloadingPageExtendedPreloadingSummary}"
            expand-aria-label="
                $i18n{preloadingPageExtendedPreloadingExpandA11yLabel}"
            no-automatic-collapse>
          <div slot="collapse" class="settings-columned-section">
            <div class="column">
              <h2 class="description-header">
                $i18n{columnHeadingWhenOn}
              </h2>
              <ul>
                <li class="secondary">
                  $i18n{preloadingPageExtendedPreloadingWhenOnBulletOne}
                </li>
                <li class="secondary">
                  $i18n{preloadingPageExtendedPreloadingWhenOnBulletTwo}
                </li>
              </ul>
            </div>
            <div class="column">
              <h2 class="description-header">
                $i18n{columnHeadingConsider}
              </h2>
              <ul>
                <li class="secondary">
                  $i18n{preloadingPageThingsToConsiderBulletOne}
                </li>
                <li class="secondary">
                  $i18n{preloadingPageExtendedPreloadingThingsToConsiderBulletTwo}
                </li>
              </ul>
            </div>
          </div>
        </settings-collapse-radio-button>
        <settings-collapse-radio-button id="preloadingStandard"
            name="[[networkPredictionOptionsEnum_.STANDARD]]"
            pref="[[prefs.net.network_prediction_options]]"
            label="$i18n{preloadingPageStandardPreloadingTitle}"
            sub-label="$i18n{preloadingPageStandardPreloadingSummary}"
            expand-aria-label="
                $i18n{preloadingPageStandardPreloadingExpandA11yLabel}"
            info-opened="{{infoOpened_}}"
            no-automatic-collapse>
          <div slot="collapse" class="settings-columned-section">
            <div class="column">
              <h2 class="description-header">
                $i18n{columnHeadingWhenOn}
              </h2>
              <ul>
                <li class="secondary">
                  $i18n{preloadingPageStandardPreloadingWhenOnBulletOne}
                </li>
                <li class="secondary">
                  $i18n{preloadingPageStandardPreloadingWhenOnBulletTwo}
                </li>
              </ul>
            </div>
            <div class="column">
              <h2 class="description-header">
                $i18n{columnHeadingConsider}
              </h2>
              <ul>
                <li class="secondary">
                  $i18n{preloadingPageThingsToConsiderBulletOne}
                </li>
              </ul>
            </div>
          </div>
        </settings-collapse-radio-button>
      </settings-radio-group>
    </div>
  </cr-collapse>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/speed_page.js
var SpeedPageElementBase = PrefsMixin(PolymerElement);
var SpeedPageElement = class extends SpeedPageElementBase {
	static get is() {
		return "settings-speed-page";
	}
	static get template() {
		return getTemplate$16();
	}
	static get properties() {
		return {
			/** Valid network prediction options state. */
			networkPredictionOptionsEnum_: {
				type: Object,
				value: NetworkPredictionOptions
			},
			numericUncheckedValues_: {
				type: Array,
				value: () => [NetworkPredictionOptions.DISABLED]
			}
		};
	}
	ready() {
		super.ready();
		CrSettingsPrefs.initialized.then(() => {
			if (this.getPref("net.network_prediction_options").value === NetworkPredictionOptions.WIFI_ONLY_DEPRECATED) this.setPrefValue("net.network_prediction_options", NetworkPredictionOptions.STANDARD);
		});
	}
	isPreloadingEnabled_(value) {
		return value !== NetworkPredictionOptions.DISABLED;
	}
	onPreloadingStateChange_() {
		this.$.preloadingExtended.updateCollapsed();
		this.$.preloadingStandard.updateCollapsed();
	}
	onPreloadingLearnMoreLinkClick_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("preloadingLearnMoreUrl"));
	}
};
customElements.define(SpeedPageElement.is, SpeedPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/performance_page_index.html.js
function getTemplate$15() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}cr-view-manager [slot=view]:not(.closing){position:initial}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">
  <settings-performance-page slot="view" id="performance" prefs="{{prefs}}">
  </settings-performance-page>

  <settings-memory-page slot="view" id="memory" prefs="{{prefs}}">
  </settings-memory-page>

  <settings-battery-page slot="view" id="battery" prefs="{{prefs}}"
      hidden="[[!showBatterySettings_]]">
  </settings-battery-page>

  <settings-speed-page slot="view" id="speed" prefs="{{prefs}}">
  </settings-speed-page>
</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/performance_page_index.js
var SettingsPerformancePageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(WebUiListenerMixin(PolymerElement)));
var SettingsPerformancePageIndexElement = class extends SettingsPerformancePageIndexElementBase {
	static get is() {
		return "settings-performance-page-index";
	}
	static get template() {
		return getTemplate$15();
	}
	static get properties() {
		return {
			prefs: Object,
			showBatterySettings_: {
				type: Boolean,
				value: false
			}
		};
	}
	showDefaultViews_() {
		this.$.viewManager.switchViews([
			"performance",
			"memory",
			"battery",
			"speed"
		], "no-animation", "no-animation");
	}
	connectedCallback() {
		super.connectedCallback();
		this.addWebUiListener("device-has-battery-changed", this.onDeviceHasBatteryChanged_.bind(this));
		PerformanceBrowserProxyImpl.getInstance().getDeviceHasBattery().then(this.onDeviceHasBatteryChanged_.bind(this));
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.PERFORMANCE:
					this.showDefaultViews_();
					break;
				case routes.BASIC: this.showDefaultViews_();
			}
		});
	}
	onDeviceHasBatteryChanged_(deviceHasBattery) {
		this.showBatterySettings_ = deviceHasBattery;
	}
};
customElements.define(SettingsPerformancePageIndexElement.is, SettingsPerformancePageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_page.html.js
function getTemplate$14() {
	return Ke`<!--_html_template_start_-->  <style include="cr-shared-style cr-hidden-style settings-shared"></style>
  <settings-section page-title="$i18n{privacyPageTitle}">
    <template is="dom-if" if="[[showClearBrowsingDataDialog_]]" restamp>
      <template is="dom-if" if="[[!enableDeleteBrowsingDataRevamp_]]" restamp>
        <settings-clear-browsing-data-dialog prefs="{{prefs}}"
            on-close="onCbdDialogClosed_">
        </settings-clear-browsing-data-dialog>
      </template>
      <template is="dom-if" if="[[enableDeleteBrowsingDataRevamp_]]" restamp>
        <settings-clear-browsing-data-dialog-v2 prefs="{{prefs}}"
            on-close="onCbdDialogClosed_"
            on-browsing-data-deleted="onBrowsingDataDeleted_">
        </settings-clear-browsing-data-dialog-v2>
      </template>
    </template>
    <template is="dom-if" if="[[showPrivacyGuideDialog_]]" restamp>
      <settings-privacy-guide-dialog id="privacyGuideDialog" prefs="{{prefs}}"
          on-close="onPrivacyGuideDialogClosed_">
      </settings-privacy-guide-dialog>
    </template>
    <cr-link-row id="clearBrowsingData"
        start-icon="cr:delete"
        label="$i18n{clearBrowsingData}"
        sub-label="$i18n{clearBrowsingDataDescription}"
        on-click="onClearBrowsingDataClick_"></cr-link-row>
    <cr-link-row id="thirdPartyCookiesLinkRow"
        start-icon="privacy:cookie"
        class="hr" label="$i18n{thirdPartyCookiesLinkRowLabel}"
        sub-label="[[computeThirdPartyCookiesSublabel_(
            prefs.profile.cookie_controls_mode.*)]]"
        on-click="onCookiesClick_"
        role-description="$i18n{subpageArrowRoleDescription}">
    </cr-link-row>
    <template is="dom-if" if=
        "[[shouldShowAdPrivacy_(
            isPrivacySandboxRestricted_,
            isPrivacySandboxRestrictedNoticeEnabled_)]]">
      <cr-link-row id="privacySandboxLinkRow"
          start-icon="privacy20:ads-click"
          class="hr"
          label="$i18n{adPrivacyLinkRowLabel}"
          sub-label="[[computeAdPrivacySublabel_(
              isPrivacySandboxRestricted_,
              isPrivacySandboxRestrictedNoticeEnabled_)]]"
          on-click="onPrivacySandboxClick_"
          role-description="$i18n{subpageArrowRoleDescription}">
      </cr-link-row>
    </template>
    <cr-link-row id="securityLinkRow" start-icon="privacy:lock"
        class="hr" label="$i18n{securityPageTitle}"
        sub-label="$i18n{securityPageDescription}"
        on-click="onSecurityPageClick_"
        role-description="$i18n{subpageArrowRoleDescription}"></cr-link-row>
    <cr-link-row id="siteSettingsLinkRow" start-icon="privacy:page-info"
        class="hr" label="$i18n{siteSettings}"
        sub-label="$i18n{siteSettingsSublabel}"
        on-click="onSiteSettingsLinkRowClick_"
        role-description="$i18n{subpageArrowRoleDescription}"></cr-link-row>
    <cr-toast id="deleteBrowsingDataToast" duration="5000">
      <div>[[dbdDeletionConfirmationToastLabel_]]</div>
    </cr-toast>
  </settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_page.js
var SettingsPrivacyPageElementBase = PrivacyGuideAvailabilityMixin(SettingsViewMixin(RouteObserverMixin(I18nMixin(PrefsMixin(PolymerElement)))));
var SettingsPrivacyPageElement = class extends SettingsPrivacyPageElementBase {
	static get is() {
		return "settings-privacy-page";
	}
	static get template() {
		return getTemplate$14();
	}
	static get properties() {
		return {
			showClearBrowsingDataDialog_: Boolean,
			showPrivacyGuideDialog_: Boolean,
			enableDeleteBrowsingDataRevamp_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableDeleteBrowsingDataRevamp")
			},
			isPrivacySandboxRestricted_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("isPrivacySandboxRestricted")
			},
			isPrivacySandboxRestrictedNoticeEnabled_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("isPrivacySandboxRestrictedNoticeEnabled")
			},
			dbdDeletionConfirmationToastLabel_: {
				type: String,
				value: ""
			},
			shouldShowDbdDeletionConfirmationToast_: {
				type: Boolean,
				value: false
			}
		};
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		this.showClearBrowsingDataDialog_ = Router.getInstance().getCurrentRoute() === routes.CLEAR_BROWSER_DATA;
		this.showPrivacyGuideDialog_ = Router.getInstance().getCurrentRoute() === routes.PRIVACY_GUIDE && this.isPrivacyGuideAvailable;
	}
	onClearBrowsingDataClick_() {
		this.interactedWithPage_();
		Router.getInstance().navigateTo(routes.CLEAR_BROWSER_DATA);
	}
	onCookiesClick_() {
		this.interactedWithPage_();
		Router.getInstance().navigateTo(routes.COOKIES);
	}
	onCbdDialogClosed_() {
		Router.getInstance().navigateTo(routes.CLEAR_BROWSER_DATA.parent);
		if (this.shouldShowDbdDeletionConfirmationToast_) {
			assert(this.dbdDeletionConfirmationToastLabel_);
			const toast = this.shadowRoot.querySelector("#deleteBrowsingDataToast");
			assert(toast);
			toast.show();
			this.shouldShowDbdDeletionConfirmationToast_ = false;
		}
		afterNextRender(this, () => {
			const toFocus = this.shadowRoot.querySelector("#clearBrowsingData");
			assert(toFocus);
			focusWithoutInk(toFocus);
		});
	}
	onPrivacyGuideDialogClosed_() {
		Router.getInstance().navigateToPreviousRoute();
		const toFocus = this.shadowRoot.querySelector("#privacyGuideLinkRow");
		assert(toFocus);
		focusWithoutInk(toFocus);
	}
	onSiteSettingsLinkRowClick_() {
		this.interactedWithPage_();
		Router.getInstance().navigateTo(routes.SITE_SETTINGS);
	}
	onSecurityPageClick_() {
		this.interactedWithPage_();
		this.metricsBrowserProxy_.recordAction("SafeBrowsing.Settings.ShowedFromParentSettings");
		Router.getInstance().navigateTo(routes.SECURITY);
	}
	onPrivacySandboxClick_() {
		this.interactedWithPage_();
		this.metricsBrowserProxy_.recordAction("Settings.PrivacySandbox.OpenedFromSettingsParent");
		Router.getInstance().navigateTo(routes.PRIVACY_SANDBOX);
	}
	onPrivacyGuideClick_() {
		this.metricsBrowserProxy_.recordPrivacyGuideEntryExitHistogram(PrivacyGuideInteractions.SETTINGS_LINK_ROW_ENTRY);
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.StartPrivacySettings");
		Router.getInstance().navigateTo(routes.PRIVACY_GUIDE, void 0, true);
	}
	interactedWithPage_() {
		HatsBrowserProxyImpl.getInstance().trustSafetyInteractionOccurred(TrustSafetyInteraction.USED_PRIVACY_CARD);
	}
	computeAdPrivacySublabel_() {
		return this.isPrivacySandboxRestricted_ && this.isPrivacySandboxRestrictedNoticeEnabled_ ? this.i18n("adPrivacyRestrictedLinkRowSubLabel") : this.i18n("adPrivacyLinkRowSubLabel");
	}
	computeThirdPartyCookiesSublabel_() {
		switch (this.getPref("profile.cookie_controls_mode").value) {
			case CookieControlsMode.OFF:
			case CookieControlsMode.INCOGNITO_ONLY: return this.i18n("thirdPartyCookiesLinkRowSublabelEnabled");
			case CookieControlsMode.BLOCK_THIRD_PARTY: return this.i18n("thirdPartyCookiesLinkRowSublabelDisabled");
			default: assertNotReached();
		}
	}
	shouldShowAdPrivacy_() {
		return !this.isPrivacySandboxRestricted_ || this.isPrivacySandboxRestrictedNoticeEnabled_;
	}
	onBrowsingDataDeleted_(e) {
		this.dbdDeletionConfirmationToastLabel_ = e.detail.deletionConfirmationText;
		this.shouldShowDbdDeletionConfirmationToast_ = true;
	}
	getFocusConfig() {
		const map = /* @__PURE__ */ new Map();
		if (routes.COOKIES) map.set(routes.COOKIES.path, "#thirdPartyCookiesLinkRow");
		if (routes.PRIVACY_GUIDE) map.set(routes.PRIVACY_GUIDE.path, "#privacyGuideLinkRow");
		if (routes.PRIVACY_SANDBOX) map.set(routes.PRIVACY_SANDBOX.path, "#privacySandboxLinkRow");
		if (routes.SECURITY) map.set(routes.SECURITY.path, "#securityLinkRow");
		if (routes.SITE_SETTINGS) map.set(routes.SITE_SETTINGS.path, "#siteSettingsLinkRow");
		return map;
	}
	getAssociatedControlFor(childViewId) {
		let triggerId = null;
		switch (childViewId) {
			case "cookies":
				triggerId = "thirdPartyCookiesLinkRow";
				break;
			case "security":
			case "securityKeys":
				triggerId = "securityLinkRow";
				break;
			case "siteSettings":
			case "siteSettingsAds":
			case "siteSettingsAll":
			case "siteSettingsAr":
			case "siteSettingsAutomaticDownloads":
			case "siteSettingsAutomaticFullscreen":
			case "siteSettingsAutoPictureInPicture":
			case "siteSettingsAutoVerify":
			case "siteSettingsBackgroundSync":
			case "siteSettingsBluetoothDevices":
			case "siteSettingsBluetoothScanning":
			case "siteSettingsCamera":
			case "siteSettingsCapturedSurfaceControl":
			case "siteSettingsClipboard":
			case "siteSettingsFederatedIdentityApi":
			case "siteSettingsFilesystemWrite":
			case "siteSettingsFilesystemWriteDetails":
			case "siteSettingsHandlers":
			case "siteSettingsHandTracking":
			case "siteSettingsHidDevices":
			case "siteSettingsIdleDetection":
			case "siteSettingsImages":
			case "siteSettingsJavascript":
			case "siteSettingsJavascriptOptimizer":
			case "siteSettingsKeyboardLock":
			case "siteSettingsLocalFonts":
			case "siteSettingsLocalNetwork":
			case "siteSettingsLocalNetworkAccess":
			case "siteSettingsLoopbackNetwork":
			case "siteSettingsLocation":
			case "siteSettingsMicrophone":
			case "siteSettingsMidiDevices":
			case "siteSettingsMixedscript":
			case "siteSettingsNotifications":
			case "siteSettingsPaymentHandler":
			case "siteSettingsPdfDocuments":
			case "siteSettingsPopups":
			case "siteSettingsProtectedContent":
			case "siteSettingsSensors":
			case "siteSettingsSerialPorts":
			case "siteSettingsSiteData":
			case "siteSettingsSiteDetails":
			case "siteSettingsSound":
			case "siteSettingsStorageAccess":
			case "siteSettingsUsbDevices":
			case "siteSettingsVr":
			case "siteSettingsWebAppInstallation":
			case "siteSettingsWebPrinting":
			case "siteSettingsWindowManagement":
			case "siteSettingsZoomLevels":
				triggerId = "siteSettingsLinkRow";
				break;
			case "privacySandbox":
			case "privacySandboxAdMeasurement":
			case "privacySandboxFledge":
			case "privacySandboxManageTopics":
			case "privacySandboxTopics":
				triggerId = "privacySandboxLinkRow";
				break;
			default: assertNotReached();
		}
		assert(triggerId);
		const control = this.shadowRoot.querySelector(`#${triggerId}`);
		assert(control);
		return control;
	}
};
customElements.define(SettingsPrivacyPageElement.is, SettingsPrivacyPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_page_index.html.js
function getTemplate$13() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}cr-view-manager [slot=view]:not(.closing){position:initial}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">

  <template is="dom-if" if="[[showPage_(pageVisibility_.safetyHub)]]">
    <template is="dom-if" if="[[renderView_(
        routes_.PRIVACY, currentRoute, inSearchMode)]]" update-when-false>
      <settings-safety-hub-entry-point slot="view" id="safetyHubEntryPoint">
      </settings-safety-hub-entry-point>
    </template>

    <template is="dom-if" if="[[renderView_(
        routes_.SAFETY_HUB, currentRoute, inSearchMode)]]"
        update-when-false>
      <!-- TODO(crbug.com/40267370): Make the page searchable.-->
      <settings-safety-hub-page slot="view" id="safetyHub" no-search
          data-parent-view-id="safetyHubEntryPoint" prefs="{{prefs}}"
          route-path$="[[routes_.SAFETY_HUB.path]]">
      </settings-safety-hub-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderPrivacyView_(currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-privacy-page slot="view" id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.PRIVACY.path]]">
    </settings-privacy-page>
  </template>

  <template is="dom-if" if="[[isAdPrivacyAvailable_]]" restamp>
    <template is="dom-if" if="[[renderView_(
        routes_.PRIVACY_SANDBOX, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-privacy-sandbox-page slot="view" id="privacySandbox"
          data-parent-view-id="privacy" prefs="{{prefs}}"
          route-path$="[[routes_.PRIVACY_SANDBOX.path]]">
      </settings-privacy-sandbox-page>
    </template>

    <template is="dom-if" if="[[renderView_(
        routes_.PRIVACY_SANDBOX_AD_MEASUREMENT, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-privacy-sandbox-ad-measurement-subpage slot="view"
          id="privacySandboxAdMeasurement" data-parent-view-id="privacy"
          prefs="{{prefs}}"
          route-path$="[[routes_.PRIVACY_SANDBOX_AD_MEASUREMENT.path]]">
      </settings-privacy-sandbox-ad-measurement-subpage>
    </template>
  </template>

  <template is="dom-if" if="[[!isPrivacySandboxRestricted_]]" restamp>
    <template is="dom-if" if="[[renderView_(
        routes_.PRIVACY_SANDBOX_FLEDGE, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-privacy-sandbox-fledge-subpage slot="view"
          id="privacySandboxFledge" data-parent-view-id="privacy"
          prefs="{{prefs}}"
          route-path$="[[routes_.PRIVACY_SANDBOX_FLEDGE.path]]">
      </settings-privacy-sandbox-fledge-subpage>
    </template>

    <template is="dom-if" if="[[renderView_(
          routes_.PRIVACY_SANDBOX_TOPICS, currentRoute, inSearchMode)]]"
          update-when-false>
      <settings-privacy-sandbox-topics-subpage slot="view"
          id="privacySandboxTopics" data-parent-view-id="privacy"
          prefs="{{prefs}}"
          route-path$="[[routes_.PRIVACY_SANDBOX_TOPICS.path]]">
      </settings-privacy-sandbox-topics-subpage>
    </template>

    <template is="dom-if" if="[[renderView_(
          routes_.PRIVACY_SANDBOX_MANAGE_TOPICS, currentRoute, inSearchMode)]]"
          update-when-false>
      <settings-privacy-sandbox-manage-topics-subpage slot="view"
          id="privacySandboxManageTopics" data-parent-view-id="privacy"
          prefs="{{prefs}}"
          route-path$="[[routes_.PRIVACY_SANDBOX_MANAGE_TOPICS.path]]">
      </settings-privacy-sandbox-manage-topics-subpage>
    </template>
  </template>

  <!-- Keep entries below sorted based on the route name. -->

  <template is="dom-if" if="[[renderView_(
      routes_.COOKIES, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-cookies-page slot="view" id="cookies"
        data-parent-view-id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.COOKIES.path]]">
    </settings-cookies-page>
  </template>

  <template is="dom-if" if="[[!enableBundledSecuritySettings_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SECURITY, currentRoute, inSearchMode)]]" update-when-false>
      <settings-security-page slot="view"
          id="security" data-parent-view-id="privacy" prefs="{{prefs}}"
          route-path$="[[routes_.SECURITY.path]]">
      </settings-security-page>
    </template>
  </template>

  <template is="dom-if" if="[[enableBundledSecuritySettings_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SECURITY, currentRoute, inSearchMode)]]" update-when-false>
      <settings-security-page-v2 slot="view"
          id="security" data-parent-view-id="privacy" prefs="{{prefs}}"
          route-path$="[[routes_.SECURITY.path]]">
      </settings-security-page-v2>
    </template>
  </template>

  <template is="dom-if" if="[[enableSecurityKeysSubpage_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SECURITY_KEYS, currentRoute, inSearchMode)]]"
        update-when-false>
      <security-keys-subpage slot="view" id="securityKeys"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SECURITY_KEYS.path]]">
      </security-keys-subpage>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-site-settings-page slot="view" id="siteSettings"
        data-parent-view-id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.SITE_SETTINGS.path]]">
    </settings-site-settings-page>
  </template>

  <template is="dom-if" if="[[enableSafeBrowsingSubresourceFilter_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_ADS, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-ads-page slot="view" id="siteSettingsAds"
          data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_ADS.path]]">
      </settings-ads-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_ALL, currentRoute, inSearchMode)]]"
      update-when-false>
    <all-sites slot="view" id="siteSettingsAll" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_ALL.path]]">
    </all-sites>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_AR, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-ar-page slot="view" id="siteSettingsAr"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_AR.path]]">
    </settings-ar-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_AUTO_VERIFY, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-anti-abuse-page slot="view" id="siteSettingsAutoVerify"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_AUTO_VERIFY.path]]">
    </settings-anti-abuse-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_AUTO_PICTURE_IN_PICTURE, currentRoute,
      inSearchMode)]]" update-when-false>
    <settings-auto-picture-in-picture-page slot="view"
        id="siteSettingsAutoPictureInPicture" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_AUTO_PICTURE_IN_PICTURE.path]]">
    </settings-auto-picture-in-picture-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_AUTOMATIC_DOWNLOADS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-automatic-downloads-page slot="view"
        id="siteSettingsAutomaticDownloads" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_AUTOMATIC_DOWNLOADS.path]]">
    </settings-automatic-downloads-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_AUTOMATIC_FULLSCREEN, currentRoute,
      inSearchMode)]]" update-when-false>
    <settings-automatic-full-screen-page slot="view"
        id="siteSettingsAutomaticFullscreen" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_AUTOMATIC_FULLSCREEN.path]]">
    </settings-automatic-full-screen-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_BACKGROUND_SYNC, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-background-sync-page slot="view"
        id="siteSettingsBackgroundSync" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_BACKGROUND_SYNC.path]]">
    </settings-background-sync-page>
  </template>

  <template is="dom-if" if="[[enableWebBluetoothNewPermissionsBackend_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_BLUETOOTH_DEVICES, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-bluetooth-devices-page slot="view"
          id="siteSettingsBluetoothDevices"
          route-path$="[[routes_.SITE_SETTINGS_BLUETOOTH_DEVICES.path]]"
          data-parent-view-id="privacy">
      </settings-bluetooth-devices-page>
    </template>
  </template>

  <template is="dom-if" if="[[enableExperimentalWebPlatformFeatures_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_BLUETOOTH_SCANNING, currentRoute,
        inSearchMode)]]" update-when-false>
      <settings-bluetooth-scanning-page slot="view"
          id="siteSettingsBluetoothScanning" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_BLUETOOTH_SCANNING.path]]">
      </settings-bluetooth-scanning-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_CAMERA, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-camera-page slot="view" id="siteSettingsCamera"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_CAMERA.path]]">
    </settings-camera-page>
  </template>

  <template is="dom-if" if="[[enableCapturedSurfaceControl_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_CAPTURED_SURFACE_CONTROL, currentRoute,
        inSearchMode)]]" update-when-false>
      <settings-captured-surface-control-page slot="view"
          id="siteSettingsCapturedSurfaceControl" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_CAPTURED_SURFACE_CONTROL.path]]">
      </settings-captured-surface-control-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_CLIPBOARD, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-clipboard-page slot="view"
        id="siteSettingsClipboard" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_CLIPBOARD.path]]">
    </settings-clipboard-page>
  </template>

  <template is="dom-if" if="[[enableFederatedIdentityApiContentSetting_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_FEDERATED_IDENTITY_API, currentRoute,
        inSearchMode)]]"
        update-when-false>
      <settings-federated-identity-api-page slot="view"
          id="siteSettingsFederatedIdentityApi"
          route-path$="[[routes_.SITE_SETTINGS_FEDERATED_IDENTITY_API.path]]"
          data-parent-view-id="privacy">
      </settings-federated-identity-api-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_FILE_SYSTEM_WRITE, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-filesystem-page slot="view"
        id="siteSettingsFilesystemWrite"
        route-path$="[[routes_.SITE_SETTINGS_FILE_SYSTEM_WRITE.path]]"
        data-parent-view-id="privacy">
    </settings-filesystem-page>
  </template>

  <template is="dom-if" if="[[enablePersistentPermissions_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_FILE_SYSTEM_WRITE_DETAILS, currentRoute,
        inSearchMode)]]" update-when-false>
      <file-system-site-details slot="view"
          id="siteSettingsFilesystemWriteDetails"
          route-path$="[[routes_.SITE_SETTINGS_FILE_SYSTEM_WRITE_DETAILS.path]]"
          data-parent-view-id="privacy">
      </file-system-site-details>
    </template>
  </template>

  <template is="dom-if" if="[[enableHandTrackingContentSetting_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_HAND_TRACKING, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-hand-tracking-page slot="view" id="siteSettingsHandTracking"
          route-path$="[[routes_.SITE_SETTINGS_HAND_TRACKING.path]]"
          data-parent-view-id="privacy">
      </settings-hand-tracking-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_HANDLERS, currentRoute, inSearchMode)]]"
      update-when-false>
    <protocol-handlers slot="view" id="siteSettingsHandlers"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_HANDLERS.path]]"
        toggle-off-label="$i18n{siteSettingsHandlersBlocked}"
        toggle-on-label="$i18n{siteSettingsHandlersAskRecommended}">
    </protocol-handlers>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_HID_DEVICES, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-hid-devices-page slot="view" id="siteSettingsHidDevices"
        route-path$="[[routes_.SITE_SETTINGS_HID_DEVICES.path]]"
        data-parent-view-id="privacy">
    </settings-hid-devices-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_IDLE_DETECTION, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-idle-detection-page slot="view" id="siteSettingsIdleDetection"
        route-path$="[[routes_.SITE_SETTINGS_IDLE_DETECTION.path]]"
        data-parent-view-id="privacy">
    </settings-idle-detection-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_IMAGES, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-images-page slot="view" id="siteSettingsImages"
        route-path$="[[routes_.SITE_SETTINGS_IMAGES.path]]"
        data-parent-view-id="privacy">
    </settings-images-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_MIXEDSCRIPT, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-insecure-content-page slot="view"
        id="siteSettingsMixedscript"
        route-path$="[[routes_.SITE_SETTINGS_MIXEDSCRIPT.path]]"
        data-parent-view-id="privacy">
    </settings-insecure-content-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_JAVASCRIPT, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-javascript-page slot="view"
        id="siteSettingsJavascript" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_JAVASCRIPT.path]]">
    </settings-javascript-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_JAVASCRIPT_OPTIMIZER, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-v8-page slot="view" id="siteSettingsJavascriptOptimizer"
      data-parent-view-id="privacy" prefs="{{prefs}}"
      route-path$="[[routes_.SITE_SETTINGS_JAVASCRIPT_OPTIMIZER.path]]">
    </settings-v8-page>
  </template>

  <template is="dom-if" if="[[enableKeyboardLockPrompt_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_KEYBOARD_LOCK, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-keyboard-lock-page slot="view" id="siteSettingsKeyboardLock"
          data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_KEYBOARD_LOCK.path]]">
      </settings-keyboard-lock-page>
    </template>
  </template>

  <template is="dom-if" if="[[enableLocalNetworkAccessSetting_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_LOCAL_NETWORK_ACCESS, currentRoute,
        inSearchMode)]]" update-when-false>
      <settings-local-network-access-page slot="view"
          id="siteSettingsLocalNetworkAccess" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_LOCAL_NETWORK_ACCESS.path]]">
      </settings-local-network-access-page>
    </template>
  </template>

  <template is="dom-if" if="[[enableLocalNetworkAccessSplitPermissions_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_LOCAL_NETWORK, currentRoute,
        inSearchMode)]]" update-when-false>
      <settings-local-network-page slot="view"
          id="siteSettingsLocalNetwork" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_LOCAL_NETWORK.path]]">
      </settings-local-network-page>
    </template>
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_LOOPBACK_NETWORK, currentRoute,
        inSearchMode)]]" update-when-false>
      <settings-loopback-network-page slot="view"
          id="siteSettingsLoopbackNetwork" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_LOOPBACK_NETWORK.path]]">
      </settings-loopback-network-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_LOCAL_FONTS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-local-fonts-page slot="view" id="siteSettingsLocalFonts"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_LOCAL_FONTS.path]]">
    </settings-local-fonts-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_LOCATION, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-geolocation-page slot="view" id="siteSettingsLocation"
        data-parent-view-id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.SITE_SETTINGS_LOCATION.path]]">
    </settings-geolocation-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_MICROPHONE, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-microphone-page slot="view"
        id="siteSettingsMicrophone" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_MICROPHONE.path]]">
    </settings-microphone-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_MIDI_DEVICES, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-midi-devices-page slot="view"
        id="siteSettingsMidiDevices" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_MIDI_DEVICES.path]]">
    </settings-midi-devices-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_NOTIFICATIONS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-notifications-page slot="view" id="siteSettingsNotifications"
        route-path$="[[routes_.SITE_SETTINGS_NOTIFICATIONS.path]]"
        data-parent-view-id="privacy" prefs="{{prefs}}">
    </settings-notifications-page>
  </template>

  <template is="dom-if" if="[[enablePaymentHandlerContentSetting_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_PAYMENT_HANDLER, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-payment-handler-page slot="view"
          id="siteSettingsPaymentHandler" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_PAYMENT_HANDLER.path]]">
      </settings-payment-handler-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_PDF_DOCUMENTS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-pdf-documents-page slot="view" id="siteSettingsPdfDocuments"
        data-parent-view-id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.SITE_SETTINGS_PDF_DOCUMENTS.path]]">
    </settings-pdf-documents-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_POPUPS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-popups-page slot="view"
        id="siteSettingsPopups" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_POPUPS.path]]">
    </settings-popups-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_PROTECTED_CONTENT, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-protected-content-page slot="view"
        id="siteSettingsProtectedContent" data-parent-view-id="privacy"
        prefs="{{prefs}}"
        route-path$="[[routes_.SITE_SETTINGS_PROTECTED_CONTENT.path]]">
    </settings-protected-content-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_SENSORS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-sensors-page slot="view"
        id="siteSettingsSensors" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_SENSORS.path]]">
    </settings-sensors-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_SERIAL_PORTS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-serial-ports-page slot="view"
        id="siteSettingsSerialPorts" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_SERIAL_PORTS.path]]">
    </settings-serial-ports-page>
  </template>



  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_SOUND, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-sound-page slot="view"
        id="siteSettingsSound" data-parent-view-id="privacy"
        prefs="{{prefs}}" route-path$="[[routes_.SITE_SETTINGS_SOUND.path]]">
    </settings-sound-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_SITE_DATA, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-site-data slot="view" id="siteSettingsSiteData"
        data-parent-view-id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.SITE_SETTINGS_SITE_DATA.path]]">
    </settings-site-data>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_SITE_DETAILS, currentRoute, inSearchMode)]]"
      update-when-false>
    <site-details slot="view" id="siteSettingsSiteDetails"
        data-parent-view-id="privacy" prefs="{{prefs}}"
        route-path$="[[routes_.SITE_SETTINGS_SITE_DETAILS.path]]">
    </site-details>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_STORAGE_ACCESS, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-storage-access-page slot="view" id="siteSettingsStorageAccess"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_STORAGE_ACCESS.path]]">
    </settings-storage-access-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_USB_DEVICES, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-usb-devices-page slot="view" id="siteSettingsUsbDevices"
        route-path$="[[routes_.SITE_SETTINGS_USB_DEVICES.path]]"
        data-parent-view-id="privacy">
    </settings-usb-devices-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_VR, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-vr-page slot="view" id="siteSettingsVr" data-parent-view-id="privacy"
      route-path$="[[routes_.SITE_SETTINGS_VR.path]]">
    </settings-vr-page>
  </template>

  <template is="dom-if" if="[[enableWebAppInstallation_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_WEB_APP_INSTALLATION, currentRoute,
        inSearchMode)]]" update-when-false>
      <settings-web-applications-page slot="view"
          id="siteSettingsWebAppInstallation" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_WEB_APP_INSTALLATION.path]]">
      </settings-web-applications-page>
    </template>
  </template>

  <template is="dom-if" if="[[enableWebPrintingContentSetting_]]">
    <template is="dom-if" if="[[renderView_(
        routes_.SITE_SETTINGS_WEB_PRINTING, currentRoute, inSearchMode)]]"
        update-when-false>
      <settings-web-printing-page slot="view"
          id="siteSettingsWebPrinting" data-parent-view-id="privacy"
          route-path$="[[routes_.SITE_SETTINGS_WEB_PRINTING.path]]">
      </settings-web-printing-page>
    </template>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_WINDOW_MANAGEMENT, currentRoute, inSearchMode)]]"
      update-when-false>
    <settings-window-management-page slot="view"
        id="siteSettingsWindowManagement" data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_WINDOW_MANAGEMENT.path]]">
    </settings-window-management-page>
  </template>

  <template is="dom-if" if="[[renderView_(
      routes_.SITE_SETTINGS_ZOOM_LEVELS, currentRoute, inSearchMode)]]"
      update-when-false>
    <zoom-levels slot="view" id="siteSettingsZoomLevels"
        data-parent-view-id="privacy"
        route-path$="[[routes_.SITE_SETTINGS_ZOOM_LEVELS.path]]">
    </zoom-levels>
  </template>

</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_page_index.js
var SettingsPrivacyPageIndexElementBase = SearchableViewContainerMixin(PrivacyGuideAvailabilityMixin(PrefsMixin(RouteObserverMixin(PolymerElement))));
var SettingsPrivacyPageIndexElement = class extends SettingsPrivacyPageIndexElementBase {
	static get is() {
		return "settings-privacy-page-index";
	}
	static get template() {
		return getTemplate$13();
	}
	static get properties() {
		return {
			prefs: Object,
			pageVisibility_: {
				type: Object,
				value: () => {
					return pageVisibility || {};
				}
			},
			routes_: {
				type: Object,
				value: () => routes
			},
			showPrivacyGuidePromo_: {
				type: Boolean,
				value: false
			},
			enableBundledSecuritySettings_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableBundledSecuritySettings")
			},
			enableCapturedSurfaceControl_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableCapturedSurfaceControl")
			},
			enableFederatedIdentityApiContentSetting_: {
				type: Boolean,
				value: () => {
					return loadTimeData$1.getBoolean("enableFederatedIdentityApiContentSetting");
				}
			},
			enableExperimentalWebPlatformFeatures_: {
				type: Boolean,
				value: () => {
					return loadTimeData$1.getBoolean("enableExperimentalWebPlatformFeatures");
				}
			},
			enableHandTrackingContentSetting_: {
				type: Boolean,
				value: () => {
					return loadTimeData$1.getBoolean("enableHandTrackingContentSetting");
				}
			},
			enablePaymentHandlerContentSetting_: {
				type: Boolean,
				value: () => {
					return loadTimeData$1.getBoolean("enablePaymentHandlerContentSetting");
				}
			},
			enablePersistentPermissions_: {
				type: Boolean,
				readOnly: true,
				value: () => loadTimeData$1.getBoolean("enablePersistentPermissions")
			},
			enableSecurityKeysSubpage_: {
				type: Boolean,
				readOnly: true,
				value: () => loadTimeData$1.getBoolean("enableSecurityKeysSubpage")
			},
			enableSafeBrowsingSubresourceFilter_: {
				type: Boolean,
				value: () => {
					return false;
				}
			},
			enableKeyboardLockPrompt_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableKeyboardLockPrompt")
			},
			enableLocalNetworkAccessSetting_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableLocalNetworkAccessSetting")
			},
			enableLocalNetworkAccessSplitPermissions_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableLocalNetworkAccessSplitPermissions")
			},
			enableWebAppInstallation_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableWebAppInstallation")
			},
			enableWebBluetoothNewPermissionsBackend_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableWebBluetoothNewPermissionsBackend")
			},
			enableWebPrintingContentSetting_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("enableWebPrintingContentSetting")
			},
			isAdPrivacyAvailable_: {
				type: Boolean,
				readOnly: true,
				value: () => {
					return !loadTimeData$1.getBoolean("isPrivacySandboxRestricted") || loadTimeData$1.getBoolean("isPrivacySandboxRestrictedNoticeEnabled");
				}
			},
			isPrivacySandboxRestricted_: {
				type: Boolean,
				readOnly: true,
				value: () => loadTimeData$1.getBoolean("isPrivacySandboxRestricted")
			}
		};
	}
	static get observers() {
		return ["updatePrivacyGuidePromoVisibility_(isPrivacyGuideAvailable, prefs.privacy_guide.viewed.value)"];
	}
	pendingViewSwitching_ = new PromiseResolver();
	privacyGuidePromoWasShown_;
	privacyGuideBrowserProxy_ = PrivacyGuideBrowserProxyImpl.getInstance();
	beforeNextRenderPromise_() {
		return new Promise((res) => {
			beforeNextRender(this, res);
		});
	}
	getDefaultViews_() {
		return ["privacy"];
	}
	isRouteHostedWithinPrivacyView_(route) {
		const nestedRoutes = [routes.CLEAR_BROWSER_DATA];
		if (loadTimeData$1.getBoolean("showPrivacyGuide")) nestedRoutes.push(routes.PRIVACY_GUIDE);
		return nestedRoutes.includes(route);
	}
	getViewIdsForRoute_(route) {
		switch (route) {
			case routes.PRIVACY: return this.getDefaultViews_();
			case routes.BASIC: return this.inSearchMode ? this.getDefaultViews_() : [];
			default:
				if (this.isRouteHostedWithinPrivacyView_(route)) return ["privacy"];
				if (routes.PRIVACY.contains(route)) {
					const view = this.$.viewManager.querySelector(`[slot='view'][route-path='${route.path}']`);
					return view ? [view.id] : null;
				}
				return [];
		}
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		if (newRoute === routes.PRIVACY) this.updatePrivacyGuidePromoVisibility_();
		this.pendingViewSwitching_ = new PromiseResolver();
		queueMicrotask(async () => {
			let viewIds = this.getViewIdsForRoute_(newRoute);
			if (viewIds !== null && viewIds.length === 0) {
				this.pendingViewSwitching_.resolve();
				return;
			}
			if (!(viewIds !== null && this.$.viewManager.querySelectorAll(viewIds.join(",")).length === viewIds.length)) {
				await this.beforeNextRenderPromise_();
				if (this.currentRoute !== newRoute || !this.isConnected) {
					this.pendingViewSwitching_.resolve();
					return;
				}
				viewIds = this.getViewIdsForRoute_(newRoute);
			}
			assert(viewIds !== null, `No views found for route ${newRoute.path}`);
			await this.$.viewManager.switchViews(viewIds, "no-animation", "no-animation");
			this.pendingViewSwitching_.resolve();
		});
	}
	whenViewSwitchingDone() {
		return this.pendingViewSwitching_.promise;
	}
	showPage_(visibility) {
		return visibility !== false;
	}
	renderView_(route) {
		return this.inSearchMode || !!this.currentRoute && this.currentRoute === route;
	}
	renderPrivacyView_() {
		return this.inSearchMode || !!this.currentRoute && (this.currentRoute === routes.PRIVACY || this.isRouteHostedWithinPrivacyView_(this.currentRoute));
	}
	updatePrivacyGuidePromoVisibility_() {
		this.showPrivacyGuidePromo_ = false;
	}
};
customElements.define(SettingsPrivacyPageIndexElement.is, SettingsPrivacyPageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/reset_page/reset_profile_banner.html.js
function getTemplate$12() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">#prefs{padding-inline-start:40px}#v2buttons{display:flex;width:100%}#learnMoreV2{margin-inline-end:auto}</style>
<cr-dialog id="dialog" close-text="$i18n{close}"
    ignore-popstate on-cancel="onCancel_">
  <div slot="title">
    <div hidden="[[!showResetProfileBannerV2]]">
      $i18n{resetAutomatedDialogV2Title}
    </div>
    <div hidden="[[showResetProfileBannerV2]]">
      $i18n{resetAutomatedDialogTitle}
    </div>
  </div>
  <div slot="body">
    <div hidden="[[!showResetProfileBannerV2]]">
      $i18n{resetAutomatedDialogV2Body}
      <div id="tamperedPrefsList" hidden="[[!showTamperedPrefsList]]">
        <ul id="prefs">
          <template is="dom-repeat" items="[[tamperedPrefs]]">
            <li>[[item]]</li>
          </template>
        </ul>
      </div>
    </div>
    <div hidden="[[showResetProfileBannerV2]]">
      <span id="description">
        $i18n{resetProfileBannerDescription}
        <a id="learnMore"
            aria-label="$i18n{resetLearnMoreAccessibilityText}"
            aria-description="$i18n{opensInNewTab}"
            href="$i18nRaw{resetProfileBannerLearnMoreUrl}"
            target="_blank">$i18n{learnMore}</a>
      </span>
    </div>
  </div>
  <div slot="button-container">
    <div id="v2buttons" hidden="[[!showResetProfileBannerV2]]">
      <cr-button id="learnMoreV2"
          aria-label="$i18n{resetLearnMoreAccessibilityText}"
          on-click="onLearnMoreClick_">
        $i18n{learnMore}
      </cr-button>
      <cr-button class="action-button" id="confirm"
          on-click="onConfirmClick_">
        $i18n{gotIt}
      </cr-button>
    </div>
    <div hidden="[[showResetProfileBannerV2]]">
      <cr-button class="cancel-button" on-click="onOkClick_" id="ok">
        $i18n{ok}
      </cr-button>
      <cr-button class="action-button" on-click="onResetClick_" id="reset">
        $i18n{resetProfileBannerButton}
      </cr-button>
    </div>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/reset_page/reset_profile_banner.js
var SettingsResetProfileBannerElementBase = I18nMixin(PolymerElement);
var SettingsResetProfileBannerElement = class extends SettingsResetProfileBannerElementBase {
	static get is() {
		return "settings-reset-profile-banner";
	}
	static get template() {
		return getTemplate$12();
	}
	static get properties() {
		return {
			showResetProfileBannerV2: {
				type: Boolean,
				value: () => loadTimeData.getBoolean("showResetProfileBannerV2")
			},
			tamperedPrefs: {
				type: Array,
				value: () => []
			},
			showTamperedPrefsList: {
				type: Boolean,
				value: false
			}
		};
	}
	browserProxy_ = ResetBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		if (this.showResetProfileBannerV2) this.browserProxy_.getTamperedPreferencePaths().then((prefs) => {
			if (prefs.length > 0) {
				this.tamperedPrefs = prefs;
				this.showTamperedPrefsList = true;
				this.$.dialog.showModal();
				this.browserProxy_.onShowResetProfileDialog();
			}
		});
		else {
			this.$.dialog.showModal();
			this.browserProxy_.onShowResetProfileDialog();
		}
	}
	onOkClick_() {
		this.$.dialog.close();
		this.browserProxy_.onHideResetProfileBanner();
	}
	onCancel_() {
		this.browserProxy_.onHideResetProfileBanner();
	}
	onResetClick_() {
		this.$.dialog.close();
		Router.getInstance().navigateTo(routes.RESET_DIALOG);
	}
	onConfirmClick_() {
		this.$.dialog.close();
		this.browserProxy_.onHideResetProfileBanner();
	}
	onLearnMoreClick_() {
		window.open(this.i18n("resetProfileBannerLearnMoreUrl"));
	}
};
customElements.define(SettingsResetProfileBannerElement.is, SettingsResetProfileBannerElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_engine_list_dialog.html.js
function getTemplate$11() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">:host{--icon-size:var(--search-engine-icon-size,24px)}.subtitle{font-size:0.75rem;line-height:22px}.title{margin:0 0 16px}.dialog-body{color:var(--cr-primary-text-color)}.search-engine{align-items:center;display:flex;flex-direction:row;gap:16px}site-favicon{--site-favicon-border-radius:4px;--site-favicon-height:var(--icon-size);--site-favicon-width:var(--icon-size)}#setAsDefaultButton{margin-inline-start:12px}#saveGuestChoiceCheckbox{margin-right:auto}cr-dialog{--cr-dialog-body-padding-horizontal:16px;--cr-dialog-button-container-padding-horizontal:24px;--cr-dialog-button-container-padding-bottom:24px;--cr-dialog-button-container-padding-top:24px;--cr-dialog-title-slot-padding-bottom:16px;--cr-dialog-title-slot-padding-end:16px;--cr-dialog-title-slot-padding-start:16px;--cr-dialog-title-slot-padding-top:16px}cr-dialog::part(body-container){max-height:360px}cr-radio-button{--cr-radio-button-size:20px;margin:0 16px}</style>

<cr-dialog id="dialog" on-cancel="onCancelClick_" show-on-attach>
  <div slot="title">
    <div class="title">$i18n{searchPageTitle}</div>
    <div class="subtitle">
      $i18n{searchEnginesSettingsDialogSubtitle}
    </div>
  </div>
  <div slot="body" class="dialog-body">
    <cr-radio-group selected="{{selectedEngineId_}}">
      <template is="dom-repeat" items="[[searchEngines]]">
        <cr-radio-button class="label-first" name="[[item.id]]">
          <div class="search-engine">
            <site-favicon favicon-url="[[item.iconURL]]" url="[[item.url]]"
                 icon-path="[[item.iconPath]]">
            </site-favicon>
            [[item.name]]
          </div>
        </cr-radio-button>
      </template>
    </cr-radio-group>
  </div>
  <div slot="button-container">
    <template is="dom-if" if="[[showSaveGuestChoice_]]" restamp>
      <cr-checkbox id="saveGuestChoiceCheckbox" checked="{{saveGuestChoice_}}">
        $i18n{saveGuestChoiceText}
      </cr-checkbox>
    </template>
    <cr-button id="cancelButton" on-click="onCancelClick_">
      $i18n{searchEnginesCancelButton}
    </cr-button>
    <cr-button id="setAsDefaultButton" class="action-button"
        on-click="onSetAsDefaultClick_" disabled="[[!searchEngines.length]]">
      $i18n{searchEnginesSetAsDefaultButton}
    </cr-button>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_engine_list_dialog.js
var SettingsSearchEngineListDialogElementBase = WebUiListenerMixin(PolymerElement);
var SettingsSearchEngineListDialogElement = class extends SettingsSearchEngineListDialogElementBase {
	static get is() {
		return "settings-search-engine-list-dialog";
	}
	static get template() {
		return getTemplate$11();
	}
	static get properties() {
		return {
			/**
			* List of search engines available.
			*/
			searchEngines: {
				type: Array,
				observer: "searchEnginesChanged_"
			},
			/**
			* The id of the search engine that is selected by the user.
			*/
			selectedEngineId_: {
				type: String,
				value: ""
			},
			/**
			* Whether the checkbox to save the search engine choice in guest mode
			* should be shown.
			*/
			showSaveGuestChoice_: {
				type: Boolean,
				computed: "computeShowSaveGuestChoice_(saveGuestChoice_)"
			},
			/**
			* State of the checkbox to save the search engine in guest mode. Null if
			* checkbox is not displayed.
			*/
			saveGuestChoice_: {
				type: Boolean,
				value: null,
				notify: true
			}
		};
	}
	browserProxy_ = SearchEnginesBrowserProxyImpl.getInstance();
	ready() {
		super.ready();
		this.browserProxy_.getSaveGuestChoice().then((saveGuestChoice) => {
			this.saveGuestChoice_ = saveGuestChoice;
		});
	}
	onSetAsDefaultClick_() {
		const searchEngine = this.searchEngines.find((engine) => engine.id === parseInt(this.selectedEngineId_));
		assert(searchEngine);
		this.browserProxy_.setDefaultSearchEngine(searchEngine.modelIndex, ChoiceMadeLocation.SEARCH_SETTINGS, this.saveGuestChoice_);
		this.dispatchEvent(new CustomEvent("search-engine-changed", {
			bubbles: true,
			composed: true,
			detail: { searchEngine }
		}));
		this.$.dialog.close();
	}
	onCancelClick_() {
		this.$.dialog.close();
	}
	searchEnginesChanged_() {
		if (!this.searchEngines.length) return;
		const defaultSearchEngine = this.searchEngines.find((searchEngine) => searchEngine.default);
		assert(defaultSearchEngine);
		this.selectedEngineId_ = defaultSearchEngine.id.toString();
	}
	computeShowSaveGuestChoice_(saveGuestChoice) {
		return saveGuestChoice !== null;
	}
};
customElements.define(SettingsSearchEngineListDialogElement.is, SettingsSearchEngineListDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_page.html.js
function getTemplate$10() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">:host{--favicon-size:0}#search-wrapper{align-items:center;display:flex;min-height:var(--cr-section-min-height)}.default-search-engine .cr-row{--cr-section-min-height:55px;gap:12px;padding:0}.default-search-engine{padding-top:var(--cr-section-vertical-padding)}.search-engine-name{margin-inline-end:auto}site-favicon{--site-favicon-border-radius:4px;--site-favicon-height:var(--favicon-size);--site-favicon-width:var(--favicon-size)}settings-search-engine-list-dialog{--search-engine-icon-size:var(--favicon-size)}
</style>
<settings-section page-title="$i18n{searchPageTitle}">
  <div route-path="default">
    <!-- Omnibox search engine -->
    <div class="cr-row first">
      <div class="default-search-engine flex">
        $i18n{searchPageTitle}
        <div class="secondary">
          $i18n{searchEngineChoiceEntryPointSubtitle}
        </div>
        <template is="dom-if" if="[[isDefaultSearchControlledByPolicy_(
            prefs.default_search_provider_data.template_url_data)]]">
          <cr-policy-pref-indicator pref="[[
              prefs.default_search_provider_data.template_url_data]]">
          </cr-policy-pref-indicator>
        </template>
        <div class="cr-row first">
          <site-favicon favicon-url="[[defaultSearchEngine_.iconURL]]"
              url="[[defaultSearchEngine_.url]]"
              icon-path="[[defaultSearchEngine_.iconPath]]">
          </site-favicon>
          <div class="search-engine-name">[[defaultSearchEngine_.name]]</div>
          <cr-button id="openDialogButton"
              on-click="onOpenDialogButtonClick_"
              disabled$="[[isDefaultSearchEngineEnforced_(
                  prefs.default_search_provider_data.template_url_data)]]">
            $i18n{searchEnginesChange}
          </cr-button>
        </div>
      </div>
      <template is="dom-if" if="[[showSearchEngineListDialog_]]" restamp>
        <settings-search-engine-list-dialog
            search-engines="[[searchEngines_]]"
            on-close="onSearchEngineListDialogClose_"
            on-search-engine-changed="onDefaultSearchEngineChangedInDialog_">
        </settings-search-engine-list-dialog>
      </template>
      <cr-toast id="confirmationToast" duration="10000">
        <div>[[confirmationToastLabel_]]</div>
      </cr-toast>
    </div>
    <template is="dom-if"
        if="[[prefs.default_search_provider_data.template_url_data.extensionId]]">
      <div class="cr-row continuation">
        <extension-controlled-indicator
            class="flex"
            extension-id="[[
                prefs.default_search_provider_data.template_url_data.extensionId]]"
            extension-name="[[
                prefs.default_search_provider_data.template_url_data.controlledByName]]"
            extension-can-be-disabled="[[
                prefs.default_search_provider_data.template_url_data.extensionCanBeDisabled]]"
            on-disable-extension="onDisableExtension_">
        </extension-controlled-indicator>
      </div>
    </template>

    <!-- Manage search engines -->
    <cr-link-row class="hr" id="enginesSubpageTrigger"
        label="$i18n{searchEnginesManageSiteSearch}"
        on-click="onManageSearchEnginesClick_"
        role-description="$i18n{subpageArrowRoleDescription}"></cr-link-row>
  </div>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_page.js
var SettingsSearchPageElementBase = SettingsViewMixin(WebUiListenerMixin(I18nMixin(PolymerElement)));
var SettingsSearchPageElement = class extends SettingsSearchPageElementBase {
	static get is() {
		return "settings-search-page";
	}
	static get template() {
		return getTemplate$10();
	}
	static get properties() {
		return {
			prefs: Object,
			/**
			* List of search engines available.
			*/
			searchEngines_: Array,
			defaultSearchEngine_: {
				type: Object,
				computed: "computeDefaultSearchEngine_(searchEngines_)"
			},
			showSearchEngineListDialog_: Boolean,
			confirmationToastLabel_: String
		};
	}
	browserProxy_ = SearchEnginesBrowserProxyImpl.getInstance();
	isEeaChoiceCountry_ = loadTimeData$1.getBoolean("isEeaChoiceCountry");
	ready() {
		super.ready();
		const updateSearchEngines = (searchEngines) => {
			this.searchEngines_ = searchEngines.defaults;
		};
		this.browserProxy_.getSearchEnginesList().then(updateSearchEngines);
		this.addWebUiListener("search-engines-changed", updateSearchEngines);
	}
	connectedCallback() {
		super.connectedCallback();
		this.setFaviconSize_();
	}
	onDisableExtension_() {
		this.dispatchEvent(new CustomEvent("refresh-pref", {
			bubbles: true,
			composed: true,
			detail: "default_search_provider.enabled"
		}));
	}
	onManageSearchEnginesClick_() {
		Router.getInstance().navigateTo(routes.SEARCH_ENGINES);
	}
	isDefaultSearchControlledByPolicy_(pref) {
		return pref.controlledBy === chrome.settingsPrivate.ControlledBy.USER_POLICY;
	}
	isDefaultSearchEngineEnforced_(pref) {
		return pref.enforcement === chrome.settingsPrivate.Enforcement.ENFORCED;
	}
	computeDefaultSearchEngine_() {
		if (!this.searchEngines_.length) return null;
		return this.searchEngines_.find((engine) => engine.default);
	}
	onOpenDialogButtonClick_() {
		this.showSearchEngineListDialog_ = true;
		chrome.metricsPrivate.recordUserAction("ChooseDefaultSearchEngine");
	}
	onDefaultSearchEngineChangedInDialog_(e) {
		this.confirmationToastLabel_ = this.i18n("searchEnginesConfirmationToastLabel", e.detail.searchEngine.name);
		this.shadowRoot.querySelector("#confirmationToast").show();
	}
	onSearchEngineListDialogClose_() {
		this.showSearchEngineListDialog_ = false;
	}
	setFaviconSize_() {
		this.style.setProperty("--favicon-size", this.isEeaChoiceCountry_ ? "24px" : "16px");
	}
	getFocusConfig() {
		return /* @__PURE__ */ new Map([[routes.SEARCH_ENGINES.path, "#enginesSubpageTrigger"]]);
	}
	getAssociatedControlFor(childViewId) {
		assert(childViewId === "searchEngines");
		const control = this.shadowRoot.querySelector("#enginesSubpageTrigger");
		assert(control);
		return control;
	}
};
customElements.define(SettingsSearchPageElement.is, SettingsSearchPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_page_index.html.js
function getTemplate$9() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">
  <settings-search-page slot="view" id="parent" prefs="{{prefs}}"
      route-path$="[[routes_.SEARCH.path]]">
  </settings-search-page>

  <settings-search-engines-page slot="view" id="searchEngines"
      data-parent-view-id="parent" prefs="{{prefs}}"
      route-path$="[[routes_.SEARCH_ENGINES.path]]">
  </settings-search-engines-page>
</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_page_index.js
var SettingsSearchPageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(PolymerElement));
var SettingsSearchPageIndexElement = class extends SettingsSearchPageIndexElementBase {
	static get is() {
		return "settings-search-page-index";
	}
	static get template() {
		return getTemplate$9();
	}
	static get properties() {
		return {
			prefs: Object,
			routes_: {
				type: Object,
				value: () => routes
			}
		};
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.SEARCH:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.SEARCH_ENGINES:
					this.$.viewManager.switchView("searchEngines", "no-animation", "no-animation");
					break;
				case routes.BASIC: this.$.viewManager.switchView("parent", "no-animation", "no-animation");
			}
		});
	}
};
customElements.define(SettingsSearchPageIndexElement.is, SettingsSearchPageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/account_card.html.js
function getTemplate$8() {
	return Ke`<!--_html_template_start_-->    <style include="cr-shared-style settings-shared">#profile-icon{background:center/cover no-repeat;border-radius:20px;flex-shrink:0;height:40px;width:40px}cr-link-row{--cr-link-row-icon-width:40px;border-top:var(--cr-separator-line)}settings-sync-account-control[showing-promo]::part(banner){border-top-left-radius:var(--cr-card-border-radius);border-top-right-radius:var(--cr-card-border-radius)}settings-sync-account-control[showing-promo]::part(title){font-size:1.1rem;line-height:1.625rem}#account-card{background-color:var(--cr-card-background-color);border-radius:var(--cr-card-border-radius);box-shadow:var(--cr-card-shadow);flex:1;margin-bottom:20px;margin-top:16px;overflow:hidden}@media (forced-colors:active){#account-card{border:var(--cr-border-hcm)}}
    </style>


  <template is="dom-if" if="[[shouldShowSyncAccountControl_(
      syncStatus.syncSystemEnabled, syncStatus.signedInStatus)]]" restamp>
    <div id="account-card">
      <settings-sync-account-control
          sync-status="[[syncStatus]]"
          prefs="{{prefs}}"
          promo-label-with-account="$i18n{peopleSignInPrompt}"
          promo-label-with-no-account="$i18n{peopleSignInPrompt}"
          promo-secondary-label-with-account=
              "$i18n{peopleSignInPromptSecondaryWithAccount}"
          promo-secondary-label-with-no-account=
              "$i18n{peopleSignInPromptSecondaryWithNoAccount}"
          access-point="[[accessPointEnum_.SETTINGS_YOUR_SAVED_INFO]]">
      </settings-sync-account-control>
    </div>
  </template>
  <template is="dom-if" if="[[shouldLinkToAccountSettingsPage_(
      syncStatus.signedInState)]]" restamp>
    <div id="account-card">
      <cr-link-row id="account-subpage-row" on-click="onAccountClick_">
        <div id="profile-icon"
            style="background-image: [[getIconImageSet_(
                primaryAccountIconUrl_)]]">
        </div>
        <div class="cr-row-gap cr-padded-text flex no-min-width">
          <div id="account-name" class="text-elide">
            [[primaryAccountName_]]
          </div>
          <div id="account-subtitle" class="secondary">
            [[getAccountRowSubtitle_(primaryAccountEmail_, syncStatus)]]
          </div>
        </div>
      </cr-link-row>
    </div>
  </template>



<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/account_card.js
var SettingsAccountCardElementBase = WebUiListenerMixin(PolymerElement);
var SettingsAccountCardElement = class extends SettingsAccountCardElementBase {
	static get is() {
		return "settings-account-card";
	}
	static get template() {
		return getTemplate$8();
	}
	static get properties() {
		return {
			/**
			* Preferences state.
			*/
			prefs: {
				type: Object,
				notify: true
			},
			/**
			* This flag is used to conditionally show a set of new sign-in UIs to the
			* profiles that have been migrated to be consistent with the web
			* sign-ins.
			*/
			signinAllowed_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("signinAllowed");
				}
			},
			/**
			* The current sync status, supplied by SyncBrowserProxy.
			*/
			syncStatus: Object,
			/**
			* Stored accounts to the system, supplied by SyncBrowserProxy.
			*/
			storedAccounts: Object,
			replaceSyncPromosWithSignInPromos_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("replaceSyncPromosWithSignInPromos")
			},
			primaryAccountName_: String,
			primaryAccountEmail_: String,
			primaryAccountIconUrl_: String,
			/** Expose ChromeSigninAccessPoint enum to HTML bindings. */
			accessPointEnum_: {
				type: Object,
				value: ChromeSigninAccessPoint
			}
		};
	}
	syncBrowserProxy_ = SyncBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		this.syncBrowserProxy_.getSyncStatus().then(this.handleSyncStatus_.bind(this));
		this.addWebUiListener("sync-status-changed", this.handleSyncStatus_.bind(this));
		this.syncBrowserProxy_.getStoredAccounts().then(this.handleStoredAccounts_.bind(this));
		this.addWebUiListener("stored-accounts-updated", this.handleStoredAccounts_.bind(this));
	}
	/**
	* Handler for when the sync state is pushed from the browser.
	*/
	handleSyncStatus_(syncStatus) {
		const shouldRecordSigninImpression = !this.syncStatus && syncStatus && this.signinAllowed_ && !this.isSyncing_() && !this.replaceSyncPromosWithSignInPromos_;
		this.syncStatus = syncStatus;
		if (shouldRecordSigninImpression && !this.shouldShowSyncAccountControl_()) chrome.metricsPrivate.recordUserAction("Signin_Impression_FromSettings");
	}
	onAccountClick_() {
		Router.getInstance().navigateTo(routes.ACCOUNT);
	}
	shouldLinkToAccountSettingsPage_() {
		return this.replaceSyncPromosWithSignInPromos_ && !!this.syncStatus && this.syncStatus.signedInState === SignedInState.SIGNED_IN;
	}
	shouldShowSyncAccountControl_() {
		if (this.syncStatus === void 0) return false;
		return !!this.syncStatus.syncSystemEnabled && this.signinAllowed_ && !this.shouldLinkToAccountSettingsPage_();
	}
	handleStoredAccounts_(accounts) {
		this.storedAccounts = accounts;
		if (accounts.length === 0) return;
		this.primaryAccountName_ = accounts[0].fullName;
		this.primaryAccountEmail_ = accounts[0].email;
		this.primaryAccountIconUrl_ = accounts[0].avatarImage;
	}
	getAccountRowSubtitle_() {
		if (!!this.syncStatus && !!this.syncStatus.statusText && this.syncStatus.statusAction === StatusAction.ENTER_PASSPHRASE) return loadTimeData$1.substituteString(this.syncStatus.statusText, this.primaryAccountEmail_);
		return this.primaryAccountEmail_;
	}
	/**
	* @return A CSS image-set for multiple scale factors.
	*/
	getIconImageSet_(iconUrl) {
		if (!iconUrl) return "";
		return getImage(iconUrl);
	}
	isSyncing_() {
		return !!this.syncStatus && this.syncStatus.signedInState === SignedInState.SYNCING;
	}
};
customElements.define(SettingsAccountCardElement.is, SettingsAccountCardElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/category_reference_card.html.js
function getTemplate$7() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">:host{background-color:var(--cr-card-background-color);box-shadow:var(--cr-card-shadow);border-radius:var(--cr-card-border-radius);overflow:hidden}hr{border:none;border-top:1px solid var(--cr-separator-color);margin:-1px 20px 0}.chips-container{padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}cr-chip{--chip-icon-size_:var(--cr-icon-size);--color-chip-border:transparent;--color-chip-icon:var(--cr-secondary-text-color);--cr-chip-border-radius:4px;--cr-chip-height:36px;display:flex;flex-direction:column}cr-chip span{font-weight:normal}cr-chip cr-icon{width:var(--chip-icon-size_);height:var(--chip-icon-size_);margin-inline-start:8px;margin-inline-end:10px}.counter{color:var(--cr-secondary-text-color)}</style>

<cr-link-row label="[[cardTitle]]" external="[[isExternal]]"
    on-click="onDataCategoryClick_">
</cr-link-row>
<hr>
<div class="chips-container">
  <template is="dom-repeat" items="[[chips]]">
    <cr-chip on-click="onDataChipClick_">
      <cr-icon icon="[[item.icon]]"></cr-icon>
      <span>[[item.label]]</span>
      <span class="counter" hidden$="[[!item.count]]">
        ([[item.count]])
      </span>
    </cr-chip>
  </template>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/category_reference_card.js
var CategoryReferenceCardElement = class extends PolymerElement {
	static get is() {
		return "category-reference-card";
	}
	static get template() {
		return getTemplate$7();
	}
	static get properties() {
		return {
			cardTitle: String,
			categoryId: Number,
			chips: {
				type: Array,
				value: () => []
			},
			isExternal: { type: Boolean }
		};
	}
	onDataCategoryClick_() {
		this.dispatchEvent(new CustomEvent("data-category-click", {
			bubbles: true,
			composed: true,
			detail: { categoryId: this.categoryId }
		}));
	}
	onDataChipClick_(event) {
		const chip = event.model.item;
		this.dispatchEvent(new CustomEvent("data-chip-click", {
			bubbles: true,
			composed: true,
			detail: { chipId: chip.id }
		}));
	}
	focus() {
		this.shadowRoot.querySelector("cr-link-row").focus();
	}
};
customElements.define(CategoryReferenceCardElement.is, CategoryReferenceCardElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/collapsible_autofill_settings_card.html.js
function getTemplate$6() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared settings-columned-section">#header-text{border-inline-end:var(--cr-separator-line)}#expandedContent{border-top:var(--cr-separator-line)}#optInAuthenticationToggle{border-top:var(--cr-separator-line)}</style>

<cr-expand-button class="cr-row first" expanded="{{expanded_}}">
  <div id="header-text">
    <div>$i18n{yourSavedInfoAutofillSettingsLabel}</div>
    <div class="cr-secondary-text">
      $i18n{yourSavedInfoAutofillSettingsDescription}
    </div>
  </div>
</cr-expand-button>
<cr-collapse id="expandedContent" opened="[[expanded_]]">
  <settings-toggle-button id="optInToggle"
      on-settings-boolean-control-change="onOptInToggleChange_"
      disabled="[[!enhancedAutofillEligibleUser_]]"
      pref="{{enhancedAutofillOptedIn_}}" no-extension-indicator
      label="$i18n{autofillAiPageTitle}"
      sub-label="$i18n{autofillAiToggleSubLabel}">
  </settings-toggle-button>

  <div class="settings-columned-section">
    <div class="column">
      <h3 class="description-header">$i18n{columnHeadingWhenOn}</h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="[[getFirstWhenOnSectionIcon_()]]" aria-hidden="true">
          </cr-icon>
          <div class="cr-secondary-text">
            [[getFirstWhenOnSectionTitle_()]]
          </div>
        </li>
        <template is="dom-if" if="[[!autofillAiAvailableByDefault_]]" restamp>
          <li>
            <cr-icon icon="settings20:text-analysis"
                aria-hidden="true">
            </cr-icon>
            <div class="cr-secondary-text">
                $i18n{autofillAiWhenOnUseToFill}
            </div>
          </li>
        </template>
      </ul>
    </div>
    <div class="column">
      <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:googleg" aria-hidden="true"></cr-icon>
          <div class="cr-secondary-text">
            $i18n{autofillAiToConsiderDataUsage}
          </div>
        </li>
        <template is="dom-if" if="[[showLoggingInfoBullet_(
            prefs.optimization_guide.model_execution.autofill_prediction_improvements_enterprise_policy_allowed.value)]]"
            restamp>
          <settings-ai-logging-info-bullet
              id="enterpriseInfoBullet"
              pref=
                  "[[prefs.optimization_guide.model_execution.autofill_prediction_improvements_enterprise_policy_allowed]]"
              logging-managed-disabled-custom-label=
                  "$i18n{autofillAiSubpageSublabelLoggingManagedDisabled}">
          </settings-ai-logging-info-bullet>
        </template>
      </ul>
    </div>
  </div>

  <template is="dom-if" if="[[autofillAiReauthOnViewingSensitiveDataEnabled_]]"
      restamp>
  <settings-toggle-button id="optInAuthenticationToggle"
      disabled="[[!enhancedAutofillEligibleUser_]]"
      pref="{{prefs.autofill.autofill_ai.reauth_before_viewing_sensitive_data}}"
      no-extension-indicator
      label="$i18n{autofillAiAuthenticationToggleTitle}"
      sub-label="$i18n{autofillAiAuthenticationToggleSubtitle}"
      no-toggle-on-host-click
      on-click="onChangeAuthenticationRequirementClicked_"
      on-change="onChangeAuthenticationRequirementClicked_">
  </settings-toggle-button>
  </template>

  <template is="dom-if" if="[[isUserEligibleForWalletablePassDetection_]]"
      restamp>
    <div class="hr"></div>
    <settings-walletable-pass-detection-toggle
        id="walletablePassDetectionToggle">
    </settings-walletable-pass-detection-toggle>
  </template>
</cr-collapse>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/collapsible_autofill_settings_card.js
var CollapsibleCardElement = class extends SettingsViewMixin(PrefsMixin(I18nMixin(PolymerElement))) {
	static get is() {
		return "collapsible-autofill-settings-card";
	}
	static get template() {
		return getTemplate$6();
	}
	static get properties() {
		return {
			/**
			* Controls the expanded/collapsed state of the details.
			*/
			expanded_: {
				type: Boolean,
				value: false
			},
			/**
			Indicates if a user is eligible to change Enhanced Autofill data.
			If a user is not eligible for Enhanced Autofill (Autofill with Ai),
			but they have data saved, the code allows them only to edit and delete
			their data. They are not allowed to add new data, or to opt in or
			opt-out of Enhanced Autofill using the corresponding toggle in this
			component. If a user is not eligible for Enhanced Autofill and they
			also have no data saved, then they cannot access this page at all.
			*/
			enhancedAutofillEligibleUser_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("userEligibleForAutofillAi");
				}
			},
			/**
			* Indicates whether the feature `kAutofillAiReauthRequired` is enabled.
			*/
			/**
			A "fake" preference object that reflects the state of the opt-in
			toggle for Enhanced Autofill and the presence/absence of an enterprise
			policy. This allows leveraging the settings-toggle-button component
			to reflect enterprise enabled/disabled states.
			*/
			enhancedAutofillOptedIn_: {
				type: Object,
				value: () => ({
					type: chrome.settingsPrivate.PrefType.BOOLEAN,
					value: false
				})
			},
			isUserEligibleForWalletablePassDetection_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("isUserEligibleForWalletablePassDetection");
				}
			},
			/**
			If true, Autofill AI does not depend on whether Autofill for addresses
			is enabled.
			*/
			autofillAiIgnoresWhetherAddressFillingIsEnabled_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("AutofillAiIgnoresWhetherAddressFillingIsEnabled");
				}
			},
			/**
			Whether the feature kAutofillAiAvailableByDefault is enabled. When
			enabled, users do not need to opt-in to enhanced Autofill to use
			Autofill AI.
			*/
			autofillAiAvailableByDefault_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("autofillAiAvailableByDefault");
				}
			}
		};
	}
	static get observers() {
		return ["onAutofillAddressPrefChanged_(prefs.autofill.profile_enabled.value)", `onEnterprisePolicyChanged_(prefs.${AiEnterpriseFeaturePrefName.AUTOFILL_AI}.value)`];
	}
	entityInstancesChangedListener_ = null;
	entityDataManager_ = EntityDataManagerProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		this.entityDataManager_.getOptInStatus().then((enhancedAutofillOptedIn) => {
			this.set("enhancedAutofillOptedIn_.value", this.enhancedAutofillEligibleUser_ && enhancedAutofillOptedIn);
		});
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.entityInstancesChangedListener_) {
			this.entityDataManager_.removeEntityInstancesChangedListener(this.entityInstancesChangedListener_);
			this.entityInstancesChangedListener_ = null;
		}
	}
	getFirstWhenOnSectionTitle_() {
		return this.i18n(this.autofillAiAvailableByDefault_ ? "autofillAiWhenOnCanFillDifficultFields" : "autofillAiWhenOnUseToFill");
	}
	getFirstWhenOnSectionIcon_() {
		return this.autofillAiAvailableByDefault_ ? "settings20:text-analysis" : "settings20:sync-saved-locally";
	}
	async onOptInToggleChange_() {
		this.enhancedAutofillEligibleUser_ = await this.entityDataManager_.setOptInStatus(this.$.optInToggle.checked);
		if (!this.enhancedAutofillEligibleUser_) this.set("enhancedAutofillOptedIn_.value", false);
	}
	onChangeAuthenticationRequirementClicked_(e) {
		e.preventDefault();
		if (!this.enhancedAutofillEligibleUser_) return;
		this.entityDataManager_.toggleAutofillAiReauthRequirement();
	}
	/**
	* Whether an info bullet regarding logging is shown. Enhanced Autofill only
	* shows logging behaviour information for enterprise clients who have either
	* the feature disabled or just logging disabled.
	*/
	showLoggingInfoBullet_(prefValue) {
		return prefValue !== ModelExecutionEnterprisePolicyValue.ALLOW;
	}
	async onAutofillAddressPrefChanged_(prefValue) {
		if (this.autofillAiIgnoresWhetherAddressFillingIsEnabled_) return;
		const enhancedAutofillOptedIn = await this.entityDataManager_.getOptInStatus();
		this.set("enhancedAutofillOptedIn_.value", this.enhancedAutofillEligibleUser_ && enhancedAutofillOptedIn && prefValue);
	}
	/**
	* Observes changes to the enterprise policy for Autofill AI keeping the
	* component's state up to date. When the policy disables the feature, updates
	* the UI to reflect the enforced state, disabling the toggle. When the policy
	* is lifted, it asynchronously fetches the user's latest opt-in status to
	* accurately restore the toggle's state without blocking the UI.
	*/
	async onEnterprisePolicyChanged_(policyValue) {
		if (policyValue === void 0) return;
		if (policyValue === ModelExecutionEnterprisePolicyValue.DISABLE) {
			this.set("enhancedAutofillOptedIn_.enforcement", chrome.settingsPrivate.Enforcement.ENFORCED);
			this.set("enhancedAutofillOptedIn_.controlledBy", chrome.settingsPrivate.ControlledBy.USER_POLICY);
			this.set("enhancedAutofillOptedIn_.value", false);
		} else {
			this.set("enhancedAutofillOptedIn_.enforcement", void 0);
			this.set("enhancedAutofillOptedIn_.controlledBy", void 0);
			const enhancedAutofillOptedIn = await this.entityDataManager_.getOptInStatus();
			const autofillEnabled = this.get("prefs.autofill.profile_enabled.value");
			this.set("enhancedAutofillOptedIn_.value", this.enhancedAutofillEligibleUser_ && enhancedAutofillOptedIn && autofillEnabled);
		}
	}
};
customElements.define(CollapsibleCardElement.is, CollapsibleCardElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/saved_info_handler_proxy.js
/**
* Type of HaTS survey, used to gauge user perception on a data management
* surface.
*/
var DataManagementSurvey;
(function(DataManagementSurvey) {
	DataManagementSurvey[DataManagementSurvey["YOUR_SAVED_INFO"] = 0] = "YOUR_SAVED_INFO";
	DataManagementSurvey[DataManagementSurvey["PASSWORDS"] = 1] = "PASSWORDS";
	DataManagementSurvey[DataManagementSurvey["PAYMENTS"] = 2] = "PAYMENTS";
	DataManagementSurvey[DataManagementSurvey["CONTACT_INFO"] = 3] = "CONTACT_INFO";
	DataManagementSurvey[DataManagementSurvey["IDENTITY_DOCS"] = 4] = "IDENTITY_DOCS";
	DataManagementSurvey[DataManagementSurvey["TRAVEL"] = 5] = "TRAVEL";
})(DataManagementSurvey || (DataManagementSurvey = {}));
var SavedInfoHandlerImpl = class SavedInfoHandlerImpl {
	getPasswordCount() {
		return sendWithPromise("getPasswordCount");
	}
	getLoyaltyCardsCount() {
		return sendWithPromise("getLoyaltyCardsCount");
	}
	requestDataManagementSurvey(survey, isFromHomePage) {
		chrome.send("requestDataManagementSurvey", [survey, isFromHomePage]);
	}
	static getInstance() {
		return instance$1 || (instance$1 = new SavedInfoHandlerImpl());
	}
	static setInstance(obj) {
		instance$1 = obj;
	}
};
var instance$1 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/your_saved_info_page.html.js
function getTemplate$5() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">#title{color:var(--cr-primary-text-color);font-size:1.375rem;font-weight:500;letter-spacing:0.02em;margin-bottom:8px;margin-top:24px;outline:none;text-align:center}#subtitle{font-size:0.813rem;line-height:1.25rem;margin:8px auto 4px auto;max-width:400px;text-align:center}.section-header{color:var(--cr-primary-text-color);font-size:0.88rem;font-weight:400;letter-spacing:0.02em;margin-bottom:12px;margin-top:var(--cr-section-vertical-margin);outline:none;padding-bottom:4px;padding-top:8px}.card-container{display:flex;flex-direction:column;gap:16px}</style>

<h1 id="title">$i18n{autofillPageTitle}</h1>
<div id="subtitle" class="secondary">$i18n{yourSavedInfoPageDescription}</div>
<settings-account-card prefs="{{prefs}}">
</settings-account-card>

<h2 id="yourSavedInfoPageTitle" class="section-header">
  $i18n{autofillPageTitle}
</h2>
<div class="card-container" on-data-category-click="onDataCategoryClick_"
    on-data-chip-click="onDataChipClick_">
  <category-reference-card card-title="$i18n{localPasswordManager}"
      is-external
      category-id="[[hierarchy_.passwordManager.id]]"
      chips="[[getVisibleChips_(hierarchy_.passwordManager.chips)]]">
  </category-reference-card>
  <category-reference-card id="paymentManagerButton"
      card-title="$i18n{paymentsTitle}"
      category-id="[[hierarchy_.payments.id]]"
      chips="[[getVisibleChips_(hierarchy_.payments.chips)]]">
  </category-reference-card>
  <category-reference-card id="addressesManagerButton"
      card-title="$i18n{contactInfoTitle}"
      category-id="[[hierarchy_.contactInfo.id]]"
      chips="[[getVisibleChips_(hierarchy_.contactInfo.chips)]]">
  </category-reference-card>
  <category-reference-card id="identityManagerButton"
      card-title="$i18n{identityDocsCardTitle}"
      category-id="[[hierarchy_.identityDocs.id]]"
      chips="[[getVisibleChips_(hierarchy_.identityDocs.chips)]]">
  </category-reference-card>
  <category-reference-card id="travelManagerButton"
      card-title="$i18n{travelCardTitle}"
      category-id="[[hierarchy_.travel.id]]"
      chips="[[getVisibleChips_(hierarchy_.travel.chips)]]">
  </category-reference-card>
</div>

<settings-section page-title="$i18n{yourSavedInfoAutofillSettingsLabel}">
  <collapsible-autofill-settings-card prefs="{{prefs}}">
  </collapsible-autofill-settings-card>
</settings-section>

<settings-section page-title="$i18n{yourSavedInfoRelatedServicesTitle}">
  <div route-path="default">
    <cr-link-row id="passwordManagerButton" label="$i18n{localPasswordManager}"
        on-click="onPasswordManagerRelatedServiceClick_"
        start-icon="cr20:password" external>
    </cr-link-row>
    <cr-link-row id="googleWalletButton" label="$i18n{googleWalletTitle}"
        on-click="onGoogleWalletRelatedServiceClick_"
        start-icon="settings20:wallet" external>
    </cr-link-row>
    <cr-link-row id="googleAccountButton" label="$i18n{googleAccount}"
        on-click="onGoogleAccountRelatedServiceClick_"
        start-icon="settings20:googleg" external>
    </cr-link-row>
  </div>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/your_saved_info_page.js
var SettingsYourSavedInfoPageElementBase = WebUiListenerMixin(SettingsViewMixin(PrefsMixin(I18nMixin(PolymerElement))));
var SettingsYourSavedInfoPageElement = class extends SettingsYourSavedInfoPageElementBase {
	static get is() {
		return "settings-your-saved-info-page";
	}
	static get template() {
		return getTemplate$5();
	}
	static get properties() {
		return {
			prefs: Object,
			hierarchy_: { type: Object }
		};
	}
	dataChipIdToChip_ = /* @__PURE__ */ new Map();
	dataChipIdToCategory_ = /* @__PURE__ */ new Map();
	dataChipIdToCategoryName_ = /* @__PURE__ */ new Map();
	availableAutofillAiTypes_ = /* @__PURE__ */ new Set();
	paymentsManager_ = PaymentsManagerImpl.getInstance();
	autofillManager_ = AutofillManagerImpl.getInstance();
	autofillAiEntityManager_ = EntityDataManagerProxyImpl.getInstance();
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	setPersonalDataListener_ = null;
	onAutofillAiEntitiesChangedListener_ = null;
	connectedCallback() {
		super.connectedCallback();
		this.initializeDataTypeHierarchy_();
		this.setupDataTypeCounters();
	}
	initializeDataTypeHierarchy_() {
		this.hierarchy_ = {
			passwordManager: {
				id: YourSavedInfoDataCategory.PASSWORD_MANAGER,
				chips: [{
					id: YourSavedInfoDataChip.PASSWORDS,
					label: this.i18n("passwordsLabel"),
					icon: "cr20:password",
					computeAvailability: () => true
				}, {
					id: YourSavedInfoDataChip.PASSKEYS,
					label: this.i18n("passkeysLabel"),
					icon: "settings20:passkey",
					computeAvailability: () => true
				}]
			},
			payments: {
				id: YourSavedInfoDataCategory.PAYMENTS,
				chips: [
					{
						id: YourSavedInfoDataChip.CREDIT_CARDS,
						label: this.i18n("creditAndDebitCardTitle"),
						icon: "settings20:credit-card",
						computeAvailability: () => true
					},
					{
						id: YourSavedInfoDataChip.IBANS,
						label: this.i18n("ibanTitle"),
						icon: "settings20:iban",
						computeAvailability: () => loadTimeData$1.getBoolean("showIbansSettings")
					},
					{
						id: YourSavedInfoDataChip.PAY_OVER_TIME,
						label: this.i18n("autofillPayOverTimeSettingsLabel"),
						icon: "settings20:hourglass",
						computeAvailability: () => loadTimeData$1.getBoolean("shouldShowPayOverTimeSettings")
					},
					{
						id: YourSavedInfoDataChip.LOYALTY_CARDS,
						label: this.i18n("loyaltyCardsTitle"),
						icon: "settings20:loyalty-programs",
						computeAvailability: () => loadTimeData$1.getBoolean("enableLoyaltyCardsFilling")
					}
				]
			},
			contactInfo: {
				id: YourSavedInfoDataCategory.CONTACT_INFO,
				chips: [{
					id: YourSavedInfoDataChip.ADDRESSES,
					label: this.i18n("addresses"),
					icon: "settings:email",
					computeAvailability: () => true
				}]
			},
			identityDocs: {
				id: YourSavedInfoDataCategory.IDENTITY_DOCS,
				chips: [
					{
						id: YourSavedInfoDataChip.DRIVERS_LICENSES,
						label: this.i18n("yourSavedInfoDriverLicenseChip"),
						icon: "settings20:id-card",
						computeAvailability: () => this.availableAutofillAiTypes_.has(EntityTypeName.kDriversLicense)
					},
					{
						id: YourSavedInfoDataChip.NATIONAL_ID_CARDS,
						label: this.i18n("yourSavedInfoNationalIdsChip"),
						icon: "settings20:id-card",
						computeAvailability: () => this.availableAutofillAiTypes_.has(EntityTypeName.kNationalIdCard)
					},
					{
						id: YourSavedInfoDataChip.PASSPORTS,
						label: this.i18n("yourSavedInfoPassportChip"),
						icon: "settings20:passport",
						computeAvailability: () => this.availableAutofillAiTypes_.has(EntityTypeName.kPassport)
					}
				]
			},
			travel: {
				id: YourSavedInfoDataCategory.TRAVEL,
				chips: [
					{
						id: YourSavedInfoDataChip.FLIGHT_RESERVATIONS,
						label: this.i18n("yourSavedInfoFlightReservationsChip"),
						icon: "settings20:travel",
						computeAvailability: () => this.availableAutofillAiTypes_.has(EntityTypeName.kFlightReservation)
					},
					{
						id: YourSavedInfoDataChip.TRAVEL_INFO,
						label: this.i18n("yourSavedInfoTravelInfoChip"),
						icon: "privacy20:person-check",
						computeAvailability: () => this.availableAutofillAiTypes_.has(EntityTypeName.kKnownTravelerNumber) || this.availableAutofillAiTypes_.has(EntityTypeName.kRedressNumber)
					},
					{
						id: YourSavedInfoDataChip.VEHICLES,
						label: this.i18n("yourSavedInfoVehiclesChip"),
						icon: "settings20:directions-car",
						computeAvailability: () => this.availableAutofillAiTypes_.has(EntityTypeName.kVehicle)
					}
				]
			}
		};
		for (const [categoryName, category] of Object.entries(this.hierarchy_)) for (const chip of category.chips) {
			this.dataChipIdToChip_.set(chip.id, chip);
			this.dataChipIdToCategory_.set(chip.id, category);
			this.dataChipIdToCategoryName_.set(chip.id, categoryName);
		}
	}
	setupDataTypeCounters() {
		const setPasswordCount = (count) => {
			this.setChipCount_(YourSavedInfoDataChip.PASSWORDS, count.passwordCount);
			this.setChipCount_(YourSavedInfoDataChip.PASSKEYS, count.passkeyCount);
		};
		this.addWebUiListener("password-count-changed", setPasswordCount);
		SavedInfoHandlerImpl.getInstance().getPasswordCount().then(setPasswordCount);
		const setAddressesListener = (addresses) => {
			this.setChipCount_(YourSavedInfoDataChip.ADDRESSES, addresses.length);
		};
		this.autofillManager_.getAddressList().then(setAddressesListener);
		const setCreditCardsListener = (creditCards) => {
			this.setChipCount_(YourSavedInfoDataChip.CREDIT_CARDS, creditCards.length);
		};
		const setIbansListener = (ibans) => {
			this.setChipCount_(YourSavedInfoDataChip.IBANS, ibans.length);
		};
		const setPayOverTimeListener = (payOverTimeIssuers) => {
			this.setChipCount_(YourSavedInfoDataChip.PAY_OVER_TIME, payOverTimeIssuers.length);
		};
		this.paymentsManager_.getCreditCardList().then(setCreditCardsListener);
		this.paymentsManager_.getIbanList().then(setIbansListener);
		this.paymentsManager_.getPayOverTimeIssuerList().then(setPayOverTimeListener);
		const setPersonalDataListener = (addresses, creditCards, ibans, payOverTimeIssuers, _accountInfo) => {
			this.setChipCount_(YourSavedInfoDataChip.ADDRESSES, addresses.length);
			this.setChipCount_(YourSavedInfoDataChip.CREDIT_CARDS, creditCards.length);
			this.setChipCount_(YourSavedInfoDataChip.IBANS, ibans.length);
			this.setChipCount_(YourSavedInfoDataChip.PAY_OVER_TIME, payOverTimeIssuers.length);
		};
		this.setPersonalDataListener_ = setPersonalDataListener;
		this.autofillManager_.setPersonalDataManagerListener(setPersonalDataListener);
		this.onAutofillAiEntitiesChangedListener_ = this.onAutofillAiEntitiesChanged.bind(this);
		this.autofillAiEntityManager_.addEntityInstancesChangedListener(this.onAutofillAiEntitiesChangedListener_);
		this.autofillAiEntityManager_.loadEntityInstances().then(this.onAutofillAiEntitiesChangedListener_);
		this.autofillAiEntityManager_.getWritableEntityTypes().then((entityTypes) => {
			for (const entityType of entityTypes) this.availableAutofillAiTypes_.add(entityType.typeName);
			this.notifyPath("hierarchy_.identityDocs.chips");
			this.notifyPath("hierarchy_.travel.chips");
		});
		const setLoyaltyCardsCount = (loyaltyCardsCount) => {
			this.setChipCount_(YourSavedInfoDataChip.LOYALTY_CARDS, loyaltyCardsCount);
		};
		this.addWebUiListener("loyalty-cards-count-changed", setLoyaltyCardsCount);
		SavedInfoHandlerImpl.getInstance().getLoyaltyCardsCount().then(setLoyaltyCardsCount);
	}
	onAutofillAiEntitiesChanged(entities) {
		const entityCounts = /* @__PURE__ */ new Map();
		for (const entity of entities) {
			const newCount = (entityCounts.get(entity.type.typeName) || 0) + 1;
			entityCounts.set(entity.type.typeName, newCount);
		}
		this.setChipCount_(YourSavedInfoDataChip.PASSPORTS, entityCounts.get(EntityTypeName.kPassport) ?? 0);
		this.setChipCount_(YourSavedInfoDataChip.DRIVERS_LICENSES, entityCounts.get(EntityTypeName.kDriversLicense) ?? 0);
		this.setChipCount_(YourSavedInfoDataChip.VEHICLES, entityCounts.get(EntityTypeName.kVehicle) ?? 0);
		this.setChipCount_(YourSavedInfoDataChip.NATIONAL_ID_CARDS, entityCounts.get(EntityTypeName.kNationalIdCard) ?? 0);
		this.setChipCount_(YourSavedInfoDataChip.TRAVEL_INFO, (entityCounts.get(EntityTypeName.kKnownTravelerNumber) ?? 0) + (entityCounts.get(EntityTypeName.kRedressNumber) ?? 0));
		this.setChipCount_(YourSavedInfoDataChip.FLIGHT_RESERVATIONS, entityCounts.get(EntityTypeName.kFlightReservation) ?? 0);
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.setPersonalDataListener_) {
			this.autofillManager_.removePersonalDataManagerListener(this.setPersonalDataListener_);
			this.setPersonalDataListener_ = null;
		}
		if (this.onAutofillAiEntitiesChangedListener_) {
			this.autofillAiEntityManager_.removeEntityInstancesChangedListener(this.onAutofillAiEntitiesChangedListener_);
			this.onAutofillAiEntitiesChangedListener_ = null;
		}
	}
	getFocusConfig() {
		const map = /* @__PURE__ */ new Map();
		if (routes.PAYMENTS) map.set(routes.PAYMENTS.path, "#paymentManagerButton");
		if (routes.YOUR_SAVED_INFO_CONTACT_INFO) map.set(routes.YOUR_SAVED_INFO_CONTACT_INFO.path, "#addressesManagerButton");
		if (routes.YOUR_SAVED_INFO_IDENTITY_DOCS) map.set(routes.YOUR_SAVED_INFO_IDENTITY_DOCS.path, "#identityManagerButton");
		if (routes.YOUR_SAVED_INFO_TRAVEL) map.set(routes.YOUR_SAVED_INFO_TRAVEL.path, "#travelManagerButton");
		return map;
	}
	getAssociatedControlFor(childViewId) {
		let triggerId;
		switch (childViewId) {
			case "contactInfo":
				triggerId = "addressesManagerButton";
				break;
			case "payments":
				triggerId = "paymentManagerButton";
				break;
			case "identityDocs":
				triggerId = "identityManagerButton";
				break;
			case "travel":
				triggerId = "travelManagerButton";
				break;
			default: assertNotReached(`Unrecognized child view ID: ${childViewId}`);
		}
		const control = this.shadowRoot.querySelector(`#${triggerId}`);
		assert(control);
		return control;
	}
	setChipCount_(chipId, count) {
		const chip = this.dataChipIdToChip_.get(chipId);
		const categoryName = this.dataChipIdToCategoryName_.get(chipId);
		chip.count = count;
		this.notifyPath(`hierarchy_.${categoryName}.chips`);
	}
	getVisibleChips_(chips) {
		return chips.filter((chip) => chip.computeAvailability() || !!chip.count).map((chip) => ({ ...chip }));
	}
	hasVisibleChips_(chips) {
		return chips.some((chip) => chip.computeAvailability() || !!chip.count);
	}
	onDataCategoryClick_(e) {
		const categoryId = e.detail.categoryId;
		this.metricsBrowserProxy_.recordYourSavedInfoCategoryClick(categoryId);
		this.navigateToLeafPage_(categoryId);
	}
	onDataChipClick_(e) {
		const chipId = e.detail.chipId;
		const category = this.dataChipIdToCategory_.get(chipId);
		this.metricsBrowserProxy_.recordYourSavedInfoDataChipClick(chipId);
		this.navigateToLeafPage_(category.id);
	}
	/**
	* Navigate to the settings sub page corresponding to a data category.
	*/
	navigateToLeafPage_(categoryId) {
		switch (categoryId) {
			case YourSavedInfoDataCategory.PASSWORD_MANAGER:
				PasswordManagerImpl.getInstance().recordPasswordsPageAccessInSettings();
				PasswordManagerImpl.getInstance().showPasswordManager(PasswordManagerPage.PASSWORDS);
				SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.PASSWORDS, true);
				break;
			case YourSavedInfoDataCategory.PAYMENTS:
				Router.getInstance().navigateTo(routes.PAYMENTS);
				break;
			case YourSavedInfoDataCategory.CONTACT_INFO:
				Router.getInstance().navigateTo(routes.YOUR_SAVED_INFO_CONTACT_INFO);
				break;
			case YourSavedInfoDataCategory.IDENTITY_DOCS:
				Router.getInstance().navigateTo(routes.YOUR_SAVED_INFO_IDENTITY_DOCS);
				break;
			case YourSavedInfoDataCategory.TRAVEL:
				Router.getInstance().navigateTo(routes.YOUR_SAVED_INFO_TRAVEL);
				break;
			case YourSavedInfoDataCategory.MAX_VALUE: assertNotReached();
			default: assertNotReachedCase(categoryId);
		}
	}
	/**
	* Opens Password Manager page on clicking a related service link.
	*/
	onPasswordManagerRelatedServiceClick_() {
		this.metricsBrowserProxy_.recordYourSavedInfoRelatedServiceClick(YourSavedInfoRelatedService.GOOGLE_PASSWORD_MANAGER);
		PasswordManagerImpl.getInstance().recordPasswordsPageAccessInSettings();
		PasswordManagerImpl.getInstance().showPasswordManager(PasswordManagerPage.PASSWORDS);
		SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.PASSWORDS, true);
	}
	/**
	* Opens Wallet page in a new tab.
	*/
	onGoogleWalletRelatedServiceClick_() {
		this.metricsBrowserProxy_.recordYourSavedInfoRelatedServiceClick(YourSavedInfoRelatedService.GOOGLE_WALLET);
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("googleWalletUrl"));
	}
	/**
	* Opens Google Account page in a new tab.
	*/
	onGoogleAccountRelatedServiceClick_() {
		this.metricsBrowserProxy_.recordYourSavedInfoRelatedServiceClick(YourSavedInfoRelatedService.GOOGLE_ACCOUNT);
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$1.getString("googleAccountUrl"));
	}
};
customElements.define(SettingsYourSavedInfoPageElement.is, SettingsYourSavedInfoPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/your_saved_info_page_index.html.js
function getTemplate$4() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">cr-view-manager [hidden-by-search],cr-view-manager[show-all] [slot=view][data-parent-view-id]{display:none}</style>

<cr-view-manager id="viewManager" class="cr-centered-card-container"
    show-all$="[[shouldShowAll]]">

  <settings-your-saved-info-page slot="view" id="parent" prefs="{{prefs}}">
  </settings-your-saved-info-page>

  <settings-autofill-section slot="view" id="contactInfo" prefs="{{prefs}}"
      data-parent-view-id="parent">
  </settings-autofill-section>

  <settings-identity-docs-page slot="view" id="identityDocs" prefs="{{prefs}}"
      data-parent-view-id="parent">
  </settings-identity-docs-page>



  <settings-payments-section slot="view" id="payments" prefs="{{prefs}}"
      data-parent-view-id="parent">
  </settings-payments-section>

  <settings-travel-page slot="view" id="travel" prefs="{{prefs}}"
      data-parent-view-id="parent">
  </settings-travel-page>

</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/your_saved_info_page/your_saved_info_page_index.js
var SettingsYourSavedInfoPageIndexElementBase = SearchableViewContainerMixin(RouteObserverMixin(PolymerElement));
var SettingsYourSavedInfoPageIndexElement = class extends SettingsYourSavedInfoPageIndexElementBase {
	static get is() {
		return "settings-your-saved-info-page-index";
	}
	static get template() {
		return getTemplate$4();
	}
	static get properties() {
		return { prefs: Object };
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		const isFromHomePage = oldRoute?.path === routes.YOUR_SAVED_INFO.path;
		queueMicrotask(() => {
			switch (newRoute) {
				case routes.YOUR_SAVED_INFO:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.YOUR_SAVED_INFO, isFromHomePage);
					break;
				case routes.BASIC:
					this.$.viewManager.switchView("parent", "no-animation", "no-animation");
					break;
				case routes.YOUR_SAVED_INFO_CONTACT_INFO:
					this.$.viewManager.switchView("contactInfo", "no-animation", "no-animation");
					SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.CONTACT_INFO, isFromHomePage);
					break;
				case routes.YOUR_SAVED_INFO_IDENTITY_DOCS:
					this.$.viewManager.switchView("identityDocs", "no-animation", "no-animation");
					SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.IDENTITY_DOCS, isFromHomePage);
					break;
				case routes.PAYMENTS:
					this.$.viewManager.switchView("payments", "no-animation", "no-animation");
					SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.PAYMENTS, isFromHomePage);
					break;
				case routes.YOUR_SAVED_INFO_TRAVEL:
					this.$.viewManager.switchView("travel", "no-animation", "no-animation");
					SavedInfoHandlerImpl.getInstance().requestDataManagementSurvey(DataManagementSurvey.TRAVEL, isFromHomePage);
			}
		});
	}
};
customElements.define(SettingsYourSavedInfoPageIndexElement.is, SettingsYourSavedInfoPageIndexElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/default_browser_page/default_browser_browser_proxy.js
/**
* @fileoverview A helper object used from the "Default Browser" section
* to interact with the browser.
*/
var DefaultBrowserBrowserProxyImpl = class DefaultBrowserBrowserProxyImpl {
	requestDefaultBrowserState() {
		return sendWithPromise("requestDefaultBrowserState");
	}
	requestUserValueStringsFeatureState() {
		return sendWithPromise("requestUserValueStringsFeatureState");
	}
	setAsDefaultBrowser(pin) {
		chrome.send("setAsDefaultBrowser", [pin]);
	}
	static getInstance() {
		return instance || (instance = new DefaultBrowserBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance = obj;
	}
};
var instance = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/default_browser_page/default_browser_page.html.js
function getTemplate$3() {
	return Ke`<!--_html_template_start_-->  <style include="cr-shared-style settings-shared"></style>
  <settings-section page-title="$i18n{defaultBrowser}"
      class="cr-centered-card-container">
    <template is="dom-if" if="[[maySetDefaultBrowser_]]">
      <div class="cr-row first">
        <div class="flex cr-padded-text">
          <div id="canBeDefaultBrowser">$i18n{defaultBrowser}</div>
          <div class="secondary" id="makeDefaultLabel">
            [[getMakeDefaultLabel(canPin_,
                userValueDefaultBrowserStringsEnabled_)]]
          </div>
        </div>
        <div class="separator"></div>
        <cr-button on-click="onSetDefaultBrowserClick_">
          $i18n{defaultBrowserMakeDefaultButton}
        </cr-button>
      </div>
    </template>
    <template is="dom-if" if="[[!maySetDefaultBrowser_]]">
      <div class="cr-row first">
        <div class="flex cr-padded-text" hidden$="[[!isDefault_]]"
            id="isDefault">
          <!--
            Shows a more user-centric string when the
            UserValueDefaultBrowserStrings feature is enabled.
            TODO(crbug.com/459593729): Clean up by removing the old string
            and this conditional logic after the feature is launched.
          -->
            <span id="defaultString"
                hidden$="[[userValueDefaultBrowserStringsEnabled_]]">
              $i18n{defaultBrowserDefault}
            </span>
            <span id="defaultStringThankYou"
                hidden$="[[!userValueDefaultBrowserStringsEnabled_]]">
              $i18n{defaultBrowserDefaultThankYou}
            </span>
        </div>
        <div class="flex cr-padded-text" hidden$="[[!isSecondaryInstall_]]"
            id="isSecondaryInstall">
          $i18n{defaultBrowserSecondary}
        </div>
        <div class="cr-padded-text" hidden$="[[!isUnknownError_]]"
            id="isUnknownError">
          $i18n{defaultBrowserError}
        </div>
      </div>
    </template>
  </settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/default_browser_page/default_browser_page.js
var SettingsDefaultBrowserPageElementBase = RouteObserverMixin(WebUiListenerMixin(PolymerElement));
var SettingsDefaultBrowserPageElement = class extends SettingsDefaultBrowserPageElementBase {
	static get is() {
		return "settings-default-browser-page";
	}
	static get template() {
		return getTemplate$3();
	}
	static get properties() {
		return {
			canPin_: Boolean,
			isDefault_: Boolean,
			isSecondaryInstall_: Boolean,
			isUnknownError_: Boolean,
			maySetDefaultBrowser_: Boolean,
			userValueDefaultBrowserStringsEnabled_: {
				type: Boolean,
				value: false
			}
		};
	}
	browserProxy_ = DefaultBrowserBrowserProxyImpl.getInstance();
	ready() {
		super.ready();
		this.addWebUiListener("browser-default-state-changed", this.updateDefaultBrowserState_.bind(this));
		this.browserProxy_.requestDefaultBrowserState().then(this.updateDefaultBrowserState_.bind(this));
	}
	currentRouteChanged(newRoute) {
		if (newRoute !== routes.DEFAULT_BROWSER) return;
		this.browserProxy_.requestUserValueStringsFeatureState().then((isEnabled) => {
			this.userValueDefaultBrowserStringsEnabled_ = isEnabled;
		});
	}
	updateDefaultBrowserState_(defaultBrowserState) {
		this.canPin_ = defaultBrowserState.canPin;
		this.isDefault_ = false;
		this.isSecondaryInstall_ = false;
		this.isUnknownError_ = false;
		this.maySetDefaultBrowser_ = false;
		if (defaultBrowserState.isDefault) this.isDefault_ = true;
		else if (!defaultBrowserState.canBeDefault) this.isSecondaryInstall_ = true;
		else if (!defaultBrowserState.isDisabledByPolicy && !defaultBrowserState.isUnknownError) this.maySetDefaultBrowser_ = true;
		else this.isUnknownError_ = true;
	}
	getMakeDefaultLabel() {
		if (this.canPin_) return loadTimeData$1.getString("defaultBrowserMakeDefaultAndPin");
		return loadTimeData$1.getString(this.userValueDefaultBrowserStringsEnabled_ ? "defaultBrowserMakeDefaultUserValue" : "defaultBrowserMakeDefault");
	}
	onSetDefaultBrowserClick_() {
		this.browserProxy_.setAsDefaultBrowser(this.canPin_);
	}
	async searchContents(query) {
		return (await getSearchManager().search(query, this)).getSearchResult();
	}
};
customElements.define(SettingsDefaultBrowserPageElement.is, SettingsDefaultBrowserPageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ensure_lazy_loaded.js
var lazyLoadPromise = null;
/** @return Resolves when the lazy load module is imported. */
function ensureLazyLoaded() {
	if (lazyLoadPromise === null) {
		const script = document.createElement("script");
		script.type = "module";
		script.src = getTrustedScriptURL`./lazy_load.js`;
		document.body.appendChild(script);
		lazyLoadPromise = Promise.all([
			"settings-appearance-page",
			"settings-autofill-section",
			"settings-payments-section",
			"settings-clear-browsing-data-dialog",
			"settings-clear-browsing-data-dialog-v2",
			"settings-search-engines-page",
			"settings-a11y-page",
			"settings-downloads-page",
			"settings-languages-page",
			"settings-reset-page",
			"settings-system-page",
			"settings-edit-dictionary-page"
		].map((name) => customElements.whenDefined(name))).then(() => {});
	}
	return lazyLoadPromise;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_main/settings_main.html.js
function getTemplate$2() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style">#noSearchResults{margin-top:80px;text-align:center}#noSearchResults div:first-child{font-size:123%;margin-bottom:10px}managed-footnote{border-top:none;margin-bottom:calc(-21px - 8px);padding-bottom:16px;padding-top:12px;position:relative;z-index:1}cr-view-manager{display:block;position:relative}cr-view-manager [hidden-by-search]{display:none}</style>
<div id="noSearchResults" hidden$="[[!showNoResultsFound_]]">
  <div>$i18n{searchNoResults}</div>
  <div>$i18nRaw{searchNoResultsHelp}</div>
</div>
<template is="dom-if" if="[[showManagedHeader_(inSearchMode_, lastRoute_)]]"
    restamp>
  <managed-footnote></managed-footnote>
</template>


  <template is="dom-if" if="[[showPage_(pageVisibility_.languages)]]">
    <settings-languages languages="{{languages_}}" prefs="{{prefs}}">
    </settings-languages>
  </template>


<template is="dom-if" if="[[showResetProfileBanner_]]" restamp>
  <settings-reset-profile-banner on-close="onResetProfileBannerClose_">
  </settings-reset-profile-banner>
</template>

<cr-view-manager id="switcher"
    show-all$="[[shouldShowAll_(inSearchMode_, lastRoute_)]]">
  <template is="dom-if" if="[[showPage_(pageVisibility_.people)]]">
    <div slot="view" id="people">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.PEOPLE, lastRoute_, inSearchMode_)]]">
        <settings-people-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-people-page-index>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showPage_(pageVisibility_.privacy)]]">
    <div slot="view" id="privacy">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.PRIVACY, lastRoute_, inSearchMode_)]]">
        <settings-privacy-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-privacy-page-index>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showAutofillPage_(pageVisibility_.autofill)]]">
    <div slot="view" id="autofill">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.AUTOFILL, lastRoute_, inSearchMode_)]]">
        <settings-autofill-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-autofill-page-index>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showYourSavedInfoPage_(
      pageVisibility_.yourSavedInfo)]]">
    <div slot="view" id="yourSavedInfo">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.YOUR_SAVED_INFO, lastRoute_, inSearchMode_)]]">
        <settings-your-saved-info-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-your-saved-info-page-index>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showPage_(pageVisibility_.performance)]]">
    <div slot="view" id="performance">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.PERFORMANCE, lastRoute_, inSearchMode_)]]">
        <settings-performance-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-performance-page-index>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showAiPage_(pageVisibility_.ai)]]">
    <div slot="view" id="ai">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.AI, lastRoute_, inSearchMode_)]]">
        <settings-ai-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-ai-page-index>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showPage_(pageVisibility_.appearance)]]">
    <div slot="view" id="appearance">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.APPEARANCE, lastRoute_, inSearchMode_)]]">
        <settings-appearance-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-appearance-page-index>
      </template>
    </div>
  </template>

  <div slot="view" id="search">
    <template is="dom-if" if="[[renderPlugin_(
        routes_.SEARCH, lastRoute_, inSearchMode_)]]">
      <settings-search-page-index prefs="{{prefs}}"
          in-search-mode="[[inSearchMode_]]">
      </settings-search-page-index>
    </template>
  </div>


  <template is="dom-if" if="[[showPage_(pageVisibility_.defaultBrowser)]]">
    <div slot="view" id="defaultBrowser">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.DEFAULT_BROWSER, lastRoute_, inSearchMode_)]]">
        <settings-default-browser-page></settings-default-browser-page>
      </template>
    </div>
  </template>


  <template is="dom-if" if="[[showPage_(pageVisibility_.onStartup)]]">
    <div slot="view" id="onStartup">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.ON_STARTUP, lastRoute_, inSearchMode_)]]">
        <settings-on-startup-page prefs="{{prefs}}">
        </settings-on-startup-page>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showPage_(pageVisibility_.languages)]]">
    <div slot="view" id="languages">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.LANGUAGES, lastRoute_, inSearchMode_)]]">


        <settings-languages-page-index prefs="{{prefs}}"
            languages="[[languages_]]" in-search-mode="[[inSearchMode_]]">
        </settings-languages-page-index>

      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showPage_(pageVisibility_.downloads)]]">
    <div slot="view" id="downloads">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.DOWNLOADS, lastRoute_, inSearchMode_)]]">
        <settings-downloads-page prefs="{{prefs}}"></settings-downloads-page>
      </template>
    </div>
  </template>

  <template is="dom-if" if="[[showPage_(pageVisibility_.a11y)]]">
    <div slot="view" id="a11y">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.ACCESSIBILITY, lastRoute_, inSearchMode_)]]">
        <settings-a11y-page-index prefs="{{prefs}}"
            in-search-mode="[[inSearchMode_]]">
        </settings-a11y-page-index>
      </template>
    </div>
  </template>


  <template is="dom-if" if="[[showPage_(pageVisibility_.system)]]">
    <div slot="view" id="system">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.SYSTEM, lastRoute_, inSearchMode_)]]">
        <settings-system-page prefs="{{prefs}}"></settings-system-page>
      </template>
    </div>
  </template>


  <template is="dom-if" if="[[showPage_(pageVisibility_.reset)]]">
    <div slot="view" id="reset">
      <template is="dom-if" if="[[renderPlugin_(
          routes_.RESET, lastRoute_, inSearchMode_)]]">
        <settings-reset-page></settings-reset-page>
      </template>
    </div>
  </template>

  <div slot="view" id="about">
    <template is="dom-if" if="[[renderPlugin_(
        routes_.ABOUT, lastRoute_, inSearchMode_)]]">
      <settings-about-page role="main" class="cr-centered-card-container"
          prefs="{{prefs}}">
      </settings-about-page>
    </template>
  </div>
</cr-view-manager>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_main/settings_main.js
var SettingsMainElementBase = RouteObserverMixin(PolymerElement);
var SettingsMainElement = class extends SettingsMainElementBase {
	static get is() {
		return "settings-main";
	}
	static get template() {
		return getTemplate$2();
	}
	static get properties() {
		return {
			/**
			* Preferences state.
			*/
			prefs: {
				type: Object,
				notify: true
			},
			pageVisibility_: {
				type: Object,
				value: () => pageVisibility || {}
			},
			lastRoute_: {
				type: Object,
				value: null
			},
			routes_: {
				type: Object,
				value: () => routes
			},
			/**
			* Whether a search operation is in progress or previous search results
			* are being displayed.
			*/
			inSearchMode_: {
				type: Boolean,
				value: false
			},
			showNoResultsFound_: {
				type: Boolean,
				value: false
			},
			showResetProfileBanner_: {
				type: Boolean,
				value() {
					return loadTimeData$1.getBoolean("showResetProfileBanner");
				}
			},
			toolbarSpinnerActive: {
				type: Boolean,
				value: false,
				notify: true
			},
			languages_: Object
		};
	}
	pendingViewSwitching_ = new PromiseResolver();
	topLevelEquivalentRoute_ = getTopLevelRoute();
	currentQuery_ = "";
	connectedCallback() {
		super.connectedCallback();
		this.setAttribute("role", "main");
		requestIdleCallback(() => ensureLazyLoaded());
	}
	beforeNextRenderPromise_() {
		return new Promise((res) => {
			beforeNextRender(this, res);
		});
	}
	async currentRouteChanged(route) {
		this.pendingViewSwitching_ = new PromiseResolver();
		if (routes.ADVANCED && routes.ADVANCED.contains(route)) ensureLazyLoaded();
		const effectiveRoute = route === routes.BASIC ? this.topLevelEquivalentRoute_ : route;
		if (this.lastRoute_ === effectiveRoute) {
			this.pendingViewSwitching_.resolve();
			return;
		}
		this.lastRoute_ = effectiveRoute;
		const newSection = effectiveRoute.section;
		let sectionElement = this.$.switcher.querySelector(`#${newSection}`);
		if (!sectionElement) {
			await this.beforeNextRenderPromise_();
			if (this.lastRoute_ !== effectiveRoute || !this.isConnected) {
				this.pendingViewSwitching_.resolve();
				return;
			}
			sectionElement = this.$.switcher.querySelector(`#${newSection}`);
		}
		assert(sectionElement);
		await this.$.switcher.switchView(sectionElement.id, "no-animation", "no-animation");
		this.pendingViewSwitching_.resolve();
	}
	whenViewSwitchingDone() {
		return this.pendingViewSwitching_.promise;
	}
	/**
	* @return A promise indicating that searching finished.
	*/
	searchContents(query) {
		this.inSearchMode_ = true;
		this.toolbarSpinnerActive = true;
		this.currentQuery_ = query;
		if (query === "") this.$.switcher.toggleAttribute("show-all", false);
		flush();
		const promises = Array.from(this.$.switcher.querySelectorAll("[slot=view] > *:not(dom-if)")).map(async (element) => {
			await customElements.whenDefined(element.tagName.toLowerCase());
			if (query !== this.currentQuery_) return {
				canceled: true,
				matchCount: 0,
				wasClearSearch: false
			};
			const result = await element.searchContents(query);
			element.toggleAttribute("hidden-by-search", query === "" ? false : result.matchCount === 0);
			return result;
		});
		return Promise.all(promises).then((results) => {
			const result = combineSearchResults(results);
			if (result.canceled) return;
			this.toolbarSpinnerActive = false;
			this.inSearchMode_ = !result.wasClearSearch;
			this.showNoResultsFound_ = this.inSearchMode_ && result.matchCount === 0;
			if (this.inSearchMode_) getInstance().announce(this.showNoResultsFound_ ? loadTimeData$1.getString("searchNoResults") : loadTimeData$1.getStringF("searchResults", query));
		});
	}
	renderPlugin_(route) {
		return this.inSearchMode_ || !!this.lastRoute_ && route.contains(this.lastRoute_);
	}
	showPage_(visibility) {
		return visibility !== false;
	}
	showAiPage_(visibility) {
		return loadTimeData$1.getBoolean("showAiPage") && this.showPage_(visibility);
	}
	showAutofillPage_(visibility) {
		return !loadTimeData$1.getBoolean("enableYourSavedInfoSettingsPage") && this.showPage_(visibility);
	}
	showYourSavedInfoPage_(visibility) {
		return loadTimeData$1.getBoolean("enableYourSavedInfoSettingsPage") && this.showPage_(visibility);
	}
	showManagedHeader_() {
		return !this.inSearchMode_ && !!this.lastRoute_ && this.lastRoute_ !== routes.ABOUT && !this.lastRoute_.isSubpage();
	}
	shouldShowAll_() {
		return this.inSearchMode_ && !!this.lastRoute_ && !this.lastRoute_.isSubpage();
	}
	onResetProfileBannerClose_() {
		this.showResetProfileBanner_ = false;
	}
};
customElements.define(SettingsMainElement.is, SettingsMainElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_menu/settings_menu.html.js
function getTemplate$1() {
	return Ke`<!--_html_template_start_-->    <style include="cr-hidden-style cr-icons cr-nav-menu-item-style">:host{box-sizing:border-box;display:block;padding-bottom:5px;padding-top:8px}:host *{-webkit-tap-highlight-color:transparent}#menu{color:var(--google-grey-700);display:flex;flex-direction:column;min-width:fit-content}#extensionsLink>.cr-icon{height:var(--cr-icon-size);margin-inline-end:14px;width:var(--cr-icon-size)}.menu-separator{border-bottom:1px solid rgba(0,0,0,0.08);margin-bottom:8px;margin-top:8px}@media (prefers-color-scheme:dark){#menu{color:var(--cr-primary-text-color)}.menu-separator{border-bottom:var(--cr-separator-line)}}
    </style>

    <div role="navigation">
      <cr-menu-selector id="menu" selectable="a:not(#extensionsLink)"
          attr-for-selected="href" on-iron-activate="onSelectorActivate_"
          on-click="onLinkClick_" selected-attribute="selected">
        <a role="menuitem"
            id="people" href="/people" hidden="[[!pageVisibility_.people]]"
            class="cr-nav-menu-item">

          <cr-icon icon="settings:person"></cr-icon>


          $i18n{peoplePageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" id="autofill" href="/autofill"
            on-click="onAutofillClick_"
            class="cr-nav-menu-item"
            hidden="[[!showAutofillMenuItem_(
                enableYourSavedInfoSettingsPage_,
                pageVisibility_.yourSavedInfo, pageVisibility_.autofill)]]">
          <cr-icon icon="settings:assignment"></cr-icon>
          $i18n{autofillPageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" href="/privacy"
            hidden="[[!pageVisibility_.privacy]]"
            class="cr-nav-menu-item">
          <cr-icon icon="settings:security"></cr-icon>
          $i18n{privacyPageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" id="performance" href="/performance"
            class="cr-nav-menu-item"
            hidden="[[!pageVisibility_.performance]]">
          <cr-icon icon="settings:navigation-performance"></cr-icon>
          $i18n{performancePageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" href="/ai"
            hidden="[[!showAiPageMenuItem_(showAiPage_, pageVisibility_.ai)]]"
            on-click="onAiPageClick_"
            class="cr-nav-menu-item">
          <cr-icon icon="settings20:magic"></cr-icon>
          $i18n{aiInnovationsPageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" id="appearance" href="/appearance"
            hidden="[[!pageVisibility_.appearance]]"
            class="cr-nav-menu-item">
          <cr-icon icon="settings:palette"></cr-icon>
          $i18n{appearancePageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" href="/search" class="cr-nav-menu-item">
          <cr-icon icon="settings:search"></cr-icon>
          $i18n{searchPageTitle}
          <cr-ripple></cr-ripple>
        </a>

        <a role="menuitem" id="defaultBrowser" class="cr-nav-menu-item"
          href="/defaultBrowser"
          hidden="[[!pageVisibility_.defaultBrowser]]">
          <cr-icon icon="settings:web"></cr-icon>
          $i18n{defaultBrowser}
          <cr-ripple></cr-ripple>
        </a>

        <a role="menuitem" id="onStartup" href="/onStartup"
            class="cr-nav-menu-item"
            hidden="[[!pageVisibility_.onStartup]]">
          <cr-icon icon="settings:power-settings"></cr-icon>
          $i18n{onStartup}
          <cr-ripple></cr-ripple>
        </a>
        <div class="menu-separator"></div>
        <a role="menuitem" id="languages" href="/languages"
            class="cr-nav-menu-item"
            hidden="[[!pageVisibility_.languages]]">
          <cr-icon icon="settings:navigation-language"></cr-icon>
          $i18n{languagesPageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" id="downloads" href="/downloads"
            class="cr-nav-menu-item"
            hidden="[[!pageVisibility_.downloads]]">
          <cr-icon icon="settings:download"></cr-icon>
          $i18n{downloadsPageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" id="accessibility" href="/accessibility"
            class="cr-nav-menu-item"
            hidden="[[!pageVisibility_.a11y]]">
          <cr-icon icon="settings:accessibility"></cr-icon>
          $i18n{a11yPageTitle}
          <cr-ripple></cr-ripple>
        </a>

        <a role="menuitem" id="system" href="/system" class="cr-nav-menu-item"
            hidden="[[!pageVisibility_.system]]">
          <cr-icon icon="settings:system"></cr-icon>
          $i18n{systemPageTitle}
          <cr-ripple></cr-ripple>
        </a>

        <a role="menuitem" id="reset" href="/reset"
            hidden="[[!pageVisibility_.reset]]" class="cr-nav-menu-item">
          <cr-icon icon="settings:restore"></cr-icon>
          $i18n{resetPageTitle}
          <cr-ripple></cr-ripple>
        </a>
        <div hidden="[[hideBottomMenuSeparator_(pageVisibility_)]]"
            class="menu-separator"></div>
        <a role="menuitem" id="extensionsLink" class="cr-nav-menu-item"
            href="astro://extensions" target="_blank"
            hidden="[[!pageVisibility_.extensions]]"
            on-click="onExtensionsLinkClick_"
            title="$i18n{extensionsLinkTooltip}">
          <cr-icon icon="settings:extension"></cr-icon>
          <span>$i18n{extensionsPageTitle}</span>
          <div class="cr-icon icon-external"></div>
          <cr-ripple></cr-ripple>
        </a>
        <a role="menuitem" id="about-menu" href="/help"
            class="cr-nav-menu-item">
          <cr-icon icon="cr:chrome-product"></cr-icon>
          $i18n{aboutPageTitle}
          <cr-ripple></cr-ripple>
        </a>
      </cr-menu-selector>
    </div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_menu/settings_menu.js
var SettingsMenuElementBase = RouteObserverMixin(PolymerElement);
var SettingsMenuElement = class extends SettingsMenuElementBase {
	static get is() {
		return "settings-menu";
	}
	static get template() {
		return getTemplate$1();
	}
	static get properties() {
		return {
			/**
			* Dictionary defining page visibility.
			*/
			pageVisibility_: {
				type: Object,
				value: () => pageVisibility
			},
			showAiPage_: {
				type: Boolean,
				value: () => loadTimeData$1.getBoolean("showAiPage")
			},
			enableYourSavedInfoSettingsPage_: {
				type: Boolean,
				value: () => {
					return loadTimeData$1.getBoolean("enableYourSavedInfoSettingsPage");
				}
			}
		};
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	showAiPageMenuItem_() {
		return this.showAiPage_ && (!this.pageVisibility_ || this.pageVisibility_.ai !== false);
	}
	showAutofillMenuItem_() {
		const showYourSavedInfo = this.enableYourSavedInfoSettingsPage_ && this.pageVisibility_?.yourSavedInfo !== false;
		const showAutofill = !this.enableYourSavedInfoSettingsPage_ && this.pageVisibility_?.autofill !== false;
		return showYourSavedInfo || showAutofill;
	}
	currentRouteChanged(newRoute) {
		const anchors = this.shadowRoot.querySelectorAll("a");
		for (let i = 0; i < anchors.length; ++i) {
			const pathname = anchors[i].getAttribute("href");
			const anchorRoute = Router.getInstance().getRouteForPath(pathname);
			if (anchorRoute && anchorRoute.contains(newRoute)) {
				this.setSelectedPath_(pathname);
				return;
			}
		}
		this.setSelectedPath_("");
	}
	focusFirstItem() {
		const firstFocusableItem = this.shadowRoot.querySelector("[role=menuitem]:not([hidden])");
		if (firstFocusableItem) firstFocusableItem.focus();
	}
	/**
	* Prevent clicks on sidebar items from navigating. These are only links for
	* accessibility purposes, taps are handled separately.
	*/
	onLinkClick_(event) {
		if (event.target.matches("a:not(#extensionsLink)")) event.preventDefault();
	}
	/**
	* Keeps both menus in sync. `path` needs to come from
	* `element.getAttribute('href')`. Using `element.href` will not work as it
	* would pass the entire URL instead of just the path.
	*/
	setSelectedPath_(path) {
		this.$.menu.selected = path;
	}
	onSelectorActivate_(event) {
		const path = event.detail.selected;
		this.setSelectedPath_(path);
		const route = Router.getInstance().getRouteForPath(path);
		assert(route, "settings-menu has an entry with an invalid route.");
		Router.getInstance().navigateTo(route, void 0, true);
	}
	onExtensionsLinkClick_() {
		chrome.metricsPrivate.recordUserAction("SettingsMenu_ExtensionsLinkClicked");
	}
	onAutofillClick_() {
		const metricName = this.enableYourSavedInfoSettingsPage_ ? "Autofill.YourSavedInfoSettingsPage.VisitReferrer" : "Autofill.AutofillAndPasswordsSettingsPage.VisitReferrer";
		this.metricsBrowserProxy_.recordAutofillSettingsReferrer(metricName, AutofillSettingsReferrer.SETTINGS_MENU);
	}
	onAiPageClick_() {
		this.metricsBrowserProxy_.recordAction("SettingsMenu_AiPageEntryPointClicked");
	}
	hideBottomMenuSeparator_() {
		if (!this.pageVisibility_) return false;
		return [
			this.pageVisibility_.languages,
			this.pageVisibility_.downloads,
			this.pageVisibility_.a11y,
			this.pageVisibility_.system,
			this.pageVisibility_.reset
		].every((visibility) => visibility === false);
	}
};
customElements.define(SettingsMenuElement.is, SettingsMenuElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_ui/settings_ui.html.js
function getTemplate() {
	return Ke`<!--_html_template_start_-->    <style include="cr-page-host-style cr-scrollable settings-shared">:host{display:flex;flex-direction:column;height:100%;--settings-menu-width:266px;--settings-main-basis:calc(var(--cr-centered-card-max-width) / var(--cr-centered-card-width-percentage))}cr-toolbar{min-height:56px;--cr-toolbar-center-basis:var(--settings-main-basis)}cr-toolbar:not([narrow]){--cr-toolbar-left-spacer-width:var(--settings-menu-width)}@media (prefers-color-scheme:light){cr-toolbar{--iron-icon-fill-color:white}}#container{display:flex;flex:1;overflow:overlay;position:relative}#left,#main,#right{flex:1 1 0}#left{height:100%;position:sticky;top:0}#left settings-menu{max-height:100%;overflow:auto;overscroll-behavior:contain;width:var(--settings-menu-width)}#main{flex-basis:var(--settings-main-basis)}@media (max-width:980px){#main{min-width:auto;padding:0 3px}}
    </style>
    <settings-prefs id="prefs" prefs="{{prefs}}"></settings-prefs>
    <cr-toolbar id="toolbar"
        page-name="$i18n{settings}"
        clear-label="$i18n{clearSearch}"
        autofocus
        search-prompt="$i18n{searchPrompt}"
        on-cr-toolbar-menu-click="onMenuButtonClick_"
        spinner-active="[[toolbarSpinnerActive_]]"
        menu-label="$i18n{menuButtonLabel}"
        on-search-changed="onSearchChanged_"
        role="banner"
        narrow="{{narrow_}}"
        narrow-threshold="980"
        show-menu="[[narrow_]]">
    </cr-toolbar>
    <cr-drawer id="drawer" on-close="onMenuClose_" heading="$i18n{settings}"
        align="$i18n{textdirection}">
      <div slot="body">
        <template is="dom-if" id="drawerTemplate">
          <settings-menu id="drawerMenu" on-iron-activate="onIronActivate_">
          </settings-menu>
        </template>
      </div>
    </cr-drawer>
    <div id="container" class="no-outline cr-scrollable">
      <div id="scrollableShadow" class="cr-scrollable-top-shadow"></div>
      <div id="left" hidden$="[[narrow_]]">
        <settings-menu id="leftMenu" on-iron-activate="onIronActivate_">
        </settings-menu>
      </div>
      <settings-main id="main" prefs="{{prefs}}"
          toolbar-spinner-active="{{toolbarSpinnerActive_}}">
      </settings-main>
      <!-- An additional child of the flex #container to take up space,
           aligned with the right-hand child of the flex toolbar. -->
      <div id="right" hidden$="[[narrow_]]"></div>
    </div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_ui/settings_ui.js
var MAX_QUERY_LENGTH = 1e3;
var SettingsUiElementBase = RouteObserverMixin(FindShortcutMixin(PolymerElement));
var SettingsUiElement = class extends SettingsUiElementBase {
	static get is() {
		return "settings-ui";
	}
	static get template() {
		return getTemplate();
	}
	static get properties() {
		return {
			/**
			* Preferences state.
			*/
			prefs: Object,
			toolbarSpinnerActive_: {
				type: Boolean,
				value: false
			},
			narrow_: {
				type: Boolean,
				observer: "onNarrowChanged_"
			},
			lastSearchQuery_: {
				type: String,
				value: ""
			}
		};
	}
	constructor() {
		super();
		Router.getInstance().initializeRouteFromUrl();
	}
	ready() {
		super.ready();
		listenOnce(this.$.drawer, "cr-drawer-opening", () => {
			this.$.drawerTemplate.if = true;
		});
		window.addEventListener("popstate", () => {
			this.$.drawer.cancel();
		});
		window.CrPolicyStrings = {
			controlledSettingExtension: loadTimeData$1.getString("controlledSettingExtension"),
			controlledSettingExtensionWithoutName: loadTimeData$1.getString("controlledSettingExtensionWithoutName"),
			controlledSettingPolicy: loadTimeData$1.getString("controlledSettingPolicy"),
			controlledSettingRecommendedMatches: loadTimeData$1.getString("controlledSettingRecommendedMatches"),
			controlledSettingRecommendedDiffers: loadTimeData$1.getString("controlledSettingRecommendedDiffers"),
			controlledSettingChildRestriction: loadTimeData$1.getString("controlledSettingChildRestriction"),
			controlledSettingParent: loadTimeData$1.getString("controlledSettingParent")
		};
		this.addEventListener("refresh-pref", this.onRefreshPref_.bind(this));
	}
	connectedCallback() {
		super.connectedCallback();
		document.documentElement.classList.remove("loading");
		document.fonts.load("bold 12px Roboto");
		setGlobalScrollTarget(this.$.container);
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		Router.getInstance().resetRouteForTesting();
		resetGlobalScrollTargetForTesting();
	}
	currentRouteChanged(route) {
		this.$.scrollableShadow.classList.toggle("force-on", route === routes.PRIVACY_GUIDE || route.depth > 1);
		const urlSearchQuery = Router.getInstance().getQueryParameters().get("search") || "";
		if (urlSearchQuery === this.lastSearchQuery_) return;
		this.lastSearchQuery_ = urlSearchQuery;
		const searchField = this.shadowRoot.querySelector("cr-toolbar").getSearchField();
		if (urlSearchQuery !== searchField.getValue()) searchField.setValue(urlSearchQuery, true);
		this.$.main.searchContents(urlSearchQuery);
	}
	handleFindShortcut(modalContextOpen) {
		if (modalContextOpen) return false;
		this.shadowRoot.querySelector("cr-toolbar").getSearchField().showAndFocus();
		return true;
	}
	searchInputHasFocus() {
		return this.shadowRoot.querySelector("cr-toolbar").getSearchField().isSearchFocused();
	}
	onRefreshPref_(e) {
		return this.$.prefs.refresh(e.detail);
	}
	/**
	* Handles the 'search-changed' event fired from the toolbar.
	*/
	onSearchChanged_(e) {
		let query = e.detail;
		if (query.length > 1e3) query = query.substring(0, MAX_QUERY_LENGTH);
		Router.getInstance().navigateTo(routes.BASIC, query.length > 0 ? new URLSearchParams("search=" + encodeURIComponent(query)) : void 0, true);
	}
	/**
	* Called when a section is selected.
	*/
	onIronActivate_() {
		this.$.drawer.close();
	}
	onMenuButtonClick_() {
		this.$.drawer.toggle();
	}
	/**
	* When this is called, The drawer animation is finished, and the dialog no
	* longer has focus. The selected section will gain focus if one was
	* selected. Otherwise, the drawer was closed due being canceled, and the
	* main settings container is given focus. That way the arrow keys can be
	* used to scroll the container, and pressing tab focuses a component in
	* settings.
	*/
	onMenuClose_() {
		if (!this.$.drawer.wasCanceled()) return;
		this.$.container.setAttribute("tabindex", "-1");
		this.$.container.focus();
		listenOnce(this.$.container, ["blur", "pointerdown"], () => {
			this.$.container.removeAttribute("tabindex");
		});
	}
	onNarrowChanged_() {
		if (this.$.drawer.open && !this.narrow_) this.$.drawer.close();
		const focusedElement = this.shadowRoot.activeElement;
		if (this.narrow_ && focusedElement === this.$.leftMenu) this.$.toolbar.focusMenuButton();
		else if (!this.narrow_ && this.$.toolbar.isMenuFocused()) this.$.leftMenu.focusFirstItem();
		else if (!this.narrow_ && focusedElement === this.shadowRoot.querySelector("#drawerMenu")) {
			const boundCloseListener = () => {
				this.$.leftMenu.focusFirstItem();
				this.$.drawer.removeEventListener("close", boundCloseListener);
			};
			this.$.drawer.addEventListener("close", boundCloseListener);
		}
	}
};
customElements.define(SettingsUiElement.is, SettingsUiElement);
//#endregion
