import "astro://resources/cr_elements/icons.html.js";
import "astro://resources/cr_elements/cr_shared_vars.css.js";
import { PromiseResolver } from "astro://resources/js/promise_resolver.js";
import "astro://resources/cr_elements/cr_shared_style.css.js";
import "astro://resources/cr_elements/cr_view_manager/cr_view_manager.js";
import "astro://resources/cr_elements/cr_button/cr_button.js";
import "astro://resources/cr_elements/cr_dialog/cr_dialog.js";
import { sendWithPromise } from "astro://resources/js/cr.js";
import { assert, assertNotReached } from "astro://resources/js/assert.js";
import { PolymerElement, afterNextRender, dedupingMixin, html } from "astro://resources/polymer/v3_0/polymer/polymer_bundled.min.js";
import "astro://resources/cr_elements/cr_icon_button/cr_icon_button.js";
import "astro://resources/cr_elements/cr_icon/cr_icon.js";
import "astro://resources/cr_elements/cr_link_row/cr_link_row.js";
import { I18nMixin } from "astro://resources/cr_elements/i18n_mixin.js";
import { WebUiListenerMixin } from "astro://resources/cr_elements/web_ui_listener_mixin.js";
import { sanitizeInnerHtml } from "astro://resources/js/parse_html_subset.js";
import "/strings.m.js";
import { loadTimeData as loadTimeData$2 } from "astro://resources/js/load_time_data.js";
import { OpenWindowProxyImpl } from "astro://resources/js/open_window_proxy.js";
import { createEmptySearchBubble, findAndRemoveHighlights, highlight, removeHighlights, stripDiacritics } from "astro://resources/js/search_highlight_utils.js";
import "astro://resources/cr_elements/md_select.css.js";
import { CrRippleMixinPolymer } from "astro://resources/cr_elements/cr_ripple/cr_ripple_mixin_polymer.js";
import "astro://resources/cr_elements/cr_input/cr_input.js";
import { AnchorAlignment } from "astro://resources/cr_elements/cr_action_menu/cr_action_menu.js";
import "astro://resources/cr_elements/cr_lazy_render/cr_lazy_render.js";
import { getFavicon, getFaviconForPageURL } from "astro://resources/js/icon.js";
import "astro://resources/cr_elements/cr_collapse/cr_collapse.js";
import "astro://resources/cr_elements/cr_expand_button/cr_expand_button.js";
import "astro://resources/cr_elements/cr_tooltip/cr_tooltip.js";
import "astro://resources/cr_elements/cr_checkbox/cr_checkbox.js";
import "astro://resources/cr_elements/cr_radio_button/cr_radio_button_style.css.js";
import { CrRadioButtonMixin } from "astro://resources/cr_elements/cr_radio_button/cr_radio_button_mixin.js";
import "astro://resources/cr_elements/cr_icons.css.js";
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/assert.js
/**
* Verify |value| is truthy.
* @param value A value to check for truthiness. Note that this
*     may be used to test whether |value| is defined or not, and we don't want
*     to force a cast to boolean.
*/
function assert$1(value, message) {
	if (value) return;
	throw new Error("Assertion failed" + (message ? `: ${message}` : ""));
}
function assertInstanceof(value, type, message) {
	if (value instanceof type) return;
	throw new Error(message || `Value ${value} is not of type ${type.name || typeof type}`);
}
/**
* Call this from places in the code that should never be reached.
*
* For example, handling all the values of enum with a switch() like this:
*
*   function getValueFromEnum(enum) {
*     switch (enum) {
*       case ENUM_FIRST_OF_TWO:
*         return first
*       case ENUM_LAST_OF_TWO:
*         return last;
*     }
*     assertNotReached();
*   }
*
* This code should only be hit in the case of serious programmer error or
* unexpected input.
*/
function assertNotReached$1(message = "Unreachable code hit") {
	assert$1(false, message);
}
/**
* Statically and dynamically assert that a code should not be reached.
*
* For example, handling all the values of enum with a switch() like this:
*
*   function getValueFromEnum(value: SomeEnum): number {
*     switch (value) {
*       case ENUM_FIRST_OF_TWO:
*         return 1;
*       case ENUM_LAST_OF_TWO:
*         return 2;
*       default:
*         assertNotReachedCase(value);
*     }
*   }
*
* Helper function that should be preferred over assertNotReached in switch/case
* statements referring to enums, because it results in a build time error if the
* 'case' statements are not exhaustive. At runtime it behaves identically to
* assertNotReached.
*/
function assertNotReachedCase$1(_param, message) {
	assertNotReached$1(message);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/third_party/polymer/v3_0/components-chromium/polymer/polymer_bundled.min.js
window.JSCompiler_renameProperty = function(t, e) {
	return t;
};
var t = 0;
var e = 0;
var n = [];
var r = 0;
var s = !1;
var i = document.createTextNode("");
new window.MutationObserver((function() {
	s = !1;
	const t = n.length;
	for (let e = 0; e < t; e++) {
		let t = n[e];
		if (t) try {
			t();
		} catch (t) {
			setTimeout((() => {
				throw t;
			}));
		}
	}
	n.splice(0, t), e += t;
})).observe(i, { characterData: !0 });
var o = {
	after: (t) => ({
		run: (e) => window.setTimeout(e, t),
		cancel(t) {
			window.clearTimeout(t);
		}
	}),
	run: (t, e) => window.setTimeout(t, e),
	cancel(t) {
		window.clearTimeout(t);
	}
};
var h = {
	run: (e) => (s || (s = !0, i.textContent = r++), n.push(e), t++),
	cancel(t) {
		const r = t - e;
		if (r >= 0) {
			if (!n[r]) throw new Error("invalid async handle: " + t);
			n[r] = null;
		}
	}
};
var c = 0;
var d$2 = function(t) {
	let e = t.__mixinApplications;
	e || (e = /* @__PURE__ */ new WeakMap(), t.__mixinApplications = e);
	let n = c++;
	return function(r) {
		let s = r.__mixinSet;
		if (s && s[n]) return r;
		let i = e, o = i.get(r);
		if (!o) {
			o = t(r), i.set(r, o);
			let e = Object.create(o.__mixinSet || s || null);
			e[n] = !0, o.__mixinSet = e;
		}
		return o;
	};
};
var _$1 = class _$1 {
	constructor() {
		this._asyncModule = null, this._callback = null, this._timer = null;
	}
	setConfig(t, e) {
		this._asyncModule = t, this._callback = e, this._timer = this._asyncModule.run((() => {
			this._timer = null, u$2.delete(this), this._callback();
		}));
	}
	cancel() {
		this.isActive() && (this._cancelAsync(), u$2.delete(this));
	}
	_cancelAsync() {
		this.isActive() && (this._asyncModule.cancel(this._timer), this._timer = null);
	}
	flush() {
		this.isActive() && (this.cancel(), this._callback());
	}
	isActive() {
		return null != this._timer;
	}
	static debounce(t, e, n) {
		return t instanceof _$1 ? t._cancelAsync() : t = new _$1(), t.setConfig(e, n), t;
	}
};
var u$2 = /* @__PURE__ */ new Set();
var p$2 = function(t) {
	u$2.add(t);
};
var f = function() {
	const t = Boolean(u$2.size);
	return u$2.forEach(((t) => {
		try {
			t.flush();
		} catch (t) {
			setTimeout((() => {
				throw t;
			}));
		}
	})), t;
};
var m$1;
var y$2;
var g$1 = /(url\()([^)]*)(\))/g;
var b$1 = /(^\/[^\/])|(^#)|(^[\w-\d]*:)/;
function P$1(t, e) {
	if (t && b$1.test(t)) return t;
	if ("//" === t) return t;
	if (void 0 === m$1) {
		m$1 = !1;
		try {
			const t = new URL("b", "http://a");
			t.pathname = "c%20d", m$1 = "http://a/c%20d" === t.href;
		} catch (t) {}
	}
	if (e || (e = document.baseURI || window.location.href), m$1) try {
		return new URL(t, e).href;
	} catch (e) {
		return t;
	}
	return y$2 || (y$2 = document.implementation.createHTMLDocument("temp"), y$2.base = y$2.createElement("base"), y$2.head.appendChild(y$2.base), y$2.anchor = y$2.createElement("a"), y$2.body.appendChild(y$2.anchor)), y$2.base.href = e, y$2.anchor.href = t, y$2.anchor.href || t;
}
function v$1(t, e) {
	return t.replace(g$1, (function(t, n, r, s) {
		return n + "'" + P$1(r.replace(/["']/g, ""), e) + "'" + s;
	}));
}
function C$1(t) {
	return t.substring(0, t.lastIndexOf("/") + 1);
}
"adoptedStyleSheets" in Document.prototype && "replaceSync" in CSSStyleSheet.prototype && (() => {
	try {
		const t = new CSSStyleSheet();
		t.replaceSync("");
		const e = document.createElement("div");
		return e.attachShadow({ mode: "open" }), e.shadowRoot.adoptedStyleSheets = [t], e.shadowRoot.adoptedStyleSheets[0] === t;
	} catch (t) {
		return !1;
	}
})();
var E$1 = window.Polymer && window.Polymer.rootPath || C$1(document.baseURI || window.location.href);
var T$1 = window.Polymer && window.Polymer.sanitizeDOMValue || void 0;
var O = window.Polymer && window.Polymer.setPassiveTouchGestures || !1;
var A$1 = window.Polymer && window.Polymer.strictTemplatePolicy || !1;
var N$1 = window.Polymer && window.Polymer.allowTemplateFromDomModule || !1;
window.Polymer;
var S$2 = window.Polymer && window.Polymer.orderedComputed || !1;
var I$1 = (t) => t;
var k$1 = "string" == typeof document.head.style.touchAction;
var L$1 = "__polymerGestures";
var M$1 = "__polymerGesturesHandled";
var D = "__polymerGesturesTouchAction";
var R$1 = [
	"mousedown",
	"mousemove",
	"mouseup",
	"click"
];
var F = [
	0,
	1,
	4,
	2
];
var H$1 = function() {
	try {
		return 1 === new MouseEvent("test", { buttons: 1 }).buttons;
	} catch (t) {
		return !1;
	}
}();
function z$1(t) {
	return R$1.indexOf(t) > -1;
}
var j$1 = !1;
function B$1(t) {
	if (!z$1(t) && "touchend" !== t) return k$1 && j$1 && O ? { passive: !0 } : void 0;
}
(function() {
	try {
		let t = Object.defineProperty({}, "passive", { get() {
			j$1 = !0;
		} });
		window.addEventListener("test", null, t), window.removeEventListener("test", null, t);
	} catch (t) {}
})();
var J = navigator.userAgent.match(/iP(?:[oa]d|hone)|Android/);
var q = [];
var Y = {
	button: !0,
	input: !0,
	keygen: !0,
	meter: !0,
	output: !0,
	textarea: !0,
	progress: !0,
	select: !0
};
var $$1 = {
	button: !0,
	command: !0,
	fieldset: !0,
	input: !0,
	keygen: !0,
	optgroup: !0,
	option: !0,
	select: !0,
	textarea: !0
};
function U(t) {
	let e = Array.prototype.slice.call(t.labels || []);
	if (!e.length) {
		e = [];
		try {
			let n = t.getRootNode();
			if (t.id) {
				let r = n.querySelectorAll(`label[for = '${t.id}']`);
				for (let t = 0; t < r.length; t++) e.push(r[t]);
			}
		} catch (t) {}
	}
	return e;
}
var V$1 = function(t) {
	let e = t.sourceCapabilities;
	var n;
	if ((!e || e.firesTouchEvents) && (t[M$1] = { skip: !0 }, "click" === t.type)) {
		let e = !1, r = Q(t);
		for (let t = 0; t < r.length; t++) {
			if (r[t].nodeType === Node.ELEMENT_NODE) {
				if ("label" === r[t].localName) q.push(r[t]);
				else if (n = r[t], Y[n.localName]) {
					let n = U(r[t]);
					for (let t = 0; t < n.length; t++) e = e || q.indexOf(n[t]) > -1;
				}
			}
			if (r[t] === W.mouse.target) return;
		}
		if (e) return;
		t.preventDefault(), t.stopPropagation();
	}
};
function X(t) {
	let e = J ? ["click"] : R$1;
	for (let n, r = 0; r < e.length; r++) n = e[r], t ? (q.length = 0, document.addEventListener(n, V$1, !0)) : document.removeEventListener(n, V$1, !0);
}
function G(t) {
	let e = t.type;
	if (!z$1(e)) return !1;
	if ("mousemove" === e) {
		let e = void 0 === t.buttons ? 1 : t.buttons;
		return t instanceof window.MouseEvent && !H$1 && (e = F[t.which] || 0), Boolean(1 & e);
	}
	return 0 === (void 0 === t.button ? 0 : t.button);
}
var W = {
	mouse: {
		target: null,
		mouseIgnoreJob: null
	},
	touch: {
		x: 0,
		y: 0,
		id: -1,
		scrollDecided: !1
	}
};
function Z(t, e, n) {
	t.movefn = e, t.upfn = n, document.addEventListener("mousemove", e), document.addEventListener("mouseup", n);
}
function K(t) {
	document.removeEventListener("mousemove", t.movefn), document.removeEventListener("mouseup", t.upfn), t.movefn = null, t.upfn = null;
}
document.addEventListener("touchend", (function(t) {
	W.mouse.mouseIgnoreJob || X(!0), W.mouse.target = Q(t)[0], W.mouse.mouseIgnoreJob = _$1.debounce(W.mouse.mouseIgnoreJob, o.after(2500), (function() {
		X(), W.mouse.target = null, W.mouse.mouseIgnoreJob = null;
	}));
}), !!j$1 && { passive: !0 });
var Q = (t) => t.composedPath && t.composedPath() || [];
var tt = {};
var et = [];
function nt(t, e) {
	let n = document.elementFromPoint(t, e), r = n;
	for (; r && r.shadowRoot;) {
		let s = r;
		if (r = r.shadowRoot.elementFromPoint(t, e), s === r) break;
		r && (n = r);
	}
	return n;
}
function rt(t) {
	const e = Q(t);
	return e.length > 0 ? e[0] : t.target;
}
function st(t) {
	let e, n = t.type, r = t.currentTarget[L$1];
	if (!r) return;
	let s = r[n];
	if (s) {
		if (!t[M$1] && (t[M$1] = {}, "touch" === n.slice(0, 5))) {
			let e = t.changedTouches[0];
			if ("touchstart" === n && 1 === t.touches.length && (W.touch.id = e.identifier), W.touch.id !== e.identifier) return;
			k$1 || "touchstart" !== n && "touchmove" !== n || function(t) {
				let e = t.changedTouches[0], n = t.type;
				if ("touchstart" === n) W.touch.x = e.clientX, W.touch.y = e.clientY, W.touch.scrollDecided = !1;
				else if ("touchmove" === n) {
					if (W.touch.scrollDecided) return;
					W.touch.scrollDecided = !0;
					let n = function(t) {
						let e = "auto", n = Q(t);
						for (let t, r = 0; r < n.length; r++) if (t = n[r], t[D]) {
							e = t[D];
							break;
						}
						return e;
					}(t), r = !1, s = Math.abs(W.touch.x - e.clientX), i = Math.abs(W.touch.y - e.clientY);
					t.cancelable && ("none" === n ? r = !0 : "pan-x" === n ? r = i > s : "pan-y" === n && (r = s > i)), r ? t.preventDefault() : ct("track");
				}
			}(t);
		}
		if (e = t[M$1], !e.skip) {
			for (let n, r = 0; r < et.length; r++) n = et[r], s[n.name] && !e[n.name] && n.flow && n.flow.start.indexOf(t.type) > -1 && n.reset && n.reset();
			for (let r, i = 0; i < et.length; i++) r = et[i], s[r.name] && !e[r.name] && (e[r.name] = !0, r[n](t));
		}
	}
}
function it(t, e, n) {
	return !!tt[e] && (function(t, e, n) {
		let r = tt[e], s = r.deps, i = r.name, o = t[L$1];
		o || (t[L$1] = o = {});
		for (let e, n, r = 0; r < s.length; r++) e = s[r], J && z$1(e) && "click" !== e || (n = o[e], n || (o[e] = n = { _count: 0 }), 0 === n._count && t.addEventListener(e, st, B$1(e)), n[i] = (n[i] || 0) + 1, n._count = (n._count || 0) + 1);
		t.addEventListener(e, n), r.touchAction && lt(t, r.touchAction);
	}(t, e, n), !0);
}
function ot(t, e, n) {
	return !!tt[e] && (function(t, e, n) {
		let r = tt[e], s = r.deps, i = r.name, o = t[L$1];
		if (o) for (let e, n, r = 0; r < s.length; r++) e = s[r], n = o[e], n && n[i] && (n[i] = (n[i] || 1) - 1, n._count = (n._count || 1) - 1, 0 === n._count && t.removeEventListener(e, st, B$1(e)));
		t.removeEventListener(e, n);
	}(t, e, n), !0);
}
function at(t) {
	et.push(t);
	for (let e = 0; e < t.emits.length; e++) tt[t.emits[e]] = t;
}
function lt(t, e) {
	k$1 && t instanceof HTMLElement && h.run((() => {
		t.style.touchAction = e;
	})), t[D] = e;
}
function ht(t, e, n) {
	let r = new Event(e, {
		bubbles: !0,
		cancelable: !0,
		composed: !0
	});
	if (r.detail = n, I$1(t).dispatchEvent(r), r.defaultPrevented) {
		let t = n.preventer || n.sourceEvent;
		t && t.preventDefault && t.preventDefault();
	}
}
function ct(t) {
	let e = function(t) {
		for (let e, n = 0; n < et.length; n++) {
			e = et[n];
			for (let n, r = 0; r < e.emits.length; r++) if (n = e.emits[r], n === t) return e;
		}
		return null;
	}(t);
	e.info && (e.info.prevent = !0);
}
function dt(t, e, n, r) {
	e && ht(e, t, {
		x: n.clientX,
		y: n.clientY,
		sourceEvent: n,
		preventer: r,
		prevent: function(t) {
			return ct(t);
		}
	});
}
function _t(t, e, n) {
	if (t.prevent) return !1;
	if (t.started) return !0;
	let r = Math.abs(t.x - e), s = Math.abs(t.y - n);
	return r >= 5 || s >= 5;
}
function ut(t, e, n) {
	if (!e) return;
	let r, s = t.moves[t.moves.length - 2], i = t.moves[t.moves.length - 1], o = i.x - t.x, a = i.y - t.y, l = 0;
	s && (r = i.x - s.x, l = i.y - s.y), ht(e, "track", {
		state: t.state,
		x: n.clientX,
		y: n.clientY,
		dx: o,
		dy: a,
		ddx: r,
		ddy: l,
		sourceEvent: n,
		hover: function() {
			return nt(n.clientX, n.clientY);
		}
	});
}
function pt(t, e, n) {
	let r = Math.abs(e.clientX - t.x), s = Math.abs(e.clientY - t.y), i = rt(n || e);
	!i || $$1[i.localName] && i.hasAttribute("disabled") || (isNaN(r) || isNaN(s) || r <= 25 && s <= 25 || function(t) {
		if ("click" === t.type) {
			if (0 === t.detail) return !0;
			let e = rt(t);
			if (!e.nodeType || e.nodeType !== Node.ELEMENT_NODE) return !0;
			let n = e.getBoundingClientRect(), r = t.pageX, s = t.pageY;
			return !(r >= n.left && r <= n.right && s >= n.top && s <= n.bottom);
		}
		return !1;
	}(e)) && (t.prevent || ht(i, "tap", {
		x: e.clientX,
		y: e.clientY,
		sourceEvent: e,
		preventer: n
	}));
}
at({
	name: "downup",
	deps: [
		"mousedown",
		"touchstart",
		"touchend"
	],
	flow: {
		start: ["mousedown", "touchstart"],
		end: ["mouseup", "touchend"]
	},
	emits: ["down", "up"],
	info: {
		movefn: null,
		upfn: null
	},
	reset: function() {
		K(this.info);
	},
	mousedown: function(t) {
		if (!G(t)) return;
		let e = rt(t), n = this;
		Z(this.info, (function(t) {
			G(t) || (dt("up", e, t), K(n.info));
		}), (function(t) {
			G(t) && dt("up", e, t), K(n.info);
		})), dt("down", e, t);
	},
	touchstart: function(t) {
		dt("down", rt(t), t.changedTouches[0], t);
	},
	touchend: function(t) {
		dt("up", rt(t), t.changedTouches[0], t);
	}
}), at({
	name: "track",
	touchAction: "none",
	deps: [
		"mousedown",
		"touchstart",
		"touchmove",
		"touchend"
	],
	flow: {
		start: ["mousedown", "touchstart"],
		end: ["mouseup", "touchend"]
	},
	emits: ["track"],
	info: {
		x: 0,
		y: 0,
		state: "start",
		started: !1,
		moves: [],
		addMove: function(t) {
			this.moves.length > 2 && this.moves.shift(), this.moves.push(t);
		},
		movefn: null,
		upfn: null,
		prevent: !1
	},
	reset: function() {
		this.info.state = "start", this.info.started = !1, this.info.moves = [], this.info.x = 0, this.info.y = 0, this.info.prevent = !1, K(this.info);
	},
	mousedown: function(t) {
		if (!G(t)) return;
		let e = rt(t), n = this, r = function(t) {
			let r = t.clientX, s = t.clientY;
			_t(n.info, r, s) && (n.info.state = n.info.started ? "mouseup" === t.type ? "end" : "track" : "start", "start" === n.info.state && ct("tap"), n.info.addMove({
				x: r,
				y: s
			}), G(t) || (n.info.state = "end", K(n.info)), e && ut(n.info, e, t), n.info.started = !0);
		};
		Z(this.info, r, (function(t) {
			n.info.started && r(t), K(n.info);
		})), this.info.x = t.clientX, this.info.y = t.clientY;
	},
	touchstart: function(t) {
		let e = t.changedTouches[0];
		this.info.x = e.clientX, this.info.y = e.clientY;
	},
	touchmove: function(t) {
		let e = rt(t), n = t.changedTouches[0], r = n.clientX, s = n.clientY;
		_t(this.info, r, s) && ("start" === this.info.state && ct("tap"), this.info.addMove({
			x: r,
			y: s
		}), ut(this.info, e, n), this.info.state = "track", this.info.started = !0);
	},
	touchend: function(t) {
		let e = rt(t), n = t.changedTouches[0];
		this.info.started && (this.info.state = "end", this.info.addMove({
			x: n.clientX,
			y: n.clientY
		}), ut(this.info, e, n));
	}
}), at({
	name: "tap",
	deps: [
		"mousedown",
		"click",
		"touchstart",
		"touchend"
	],
	flow: {
		start: ["mousedown", "touchstart"],
		end: ["click", "touchend"]
	},
	emits: ["tap"],
	info: {
		x: NaN,
		y: NaN,
		prevent: !1
	},
	reset: function() {
		this.info.x = NaN, this.info.y = NaN, this.info.prevent = !1;
	},
	mousedown: function(t) {
		G(t) && (this.info.x = t.clientX, this.info.y = t.clientY);
	},
	click: function(t) {
		G(t) && pt(this.info, t);
	},
	touchstart: function(t) {
		const e = t.changedTouches[0];
		this.info.x = e.clientX, this.info.y = e.clientY;
	},
	touchend: function(t) {
		pt(this.info, t.changedTouches[0], t);
	}
});
Object.freeze({
	__proto__: null,
	add: it,
	addListener: it,
	deepTargetFind: nt,
	findOriginalTarget: rt,
	gestures: tt,
	prevent: ct,
	recognizers: et,
	register: at,
	remove: ot,
	removeListener: ot,
	resetMouseCanceller: function() {
		W.mouse.mouseIgnoreJob && W.mouse.mouseIgnoreJob.flush();
	},
	setTouchAction: lt
});
var bt = {};
var Pt = {};
function vt(t, e) {
	bt[t] = Pt[t.toLowerCase()] = e;
}
function Ct(t) {
	return bt[t] || Pt[t.toLowerCase()];
}
var wt = class extends HTMLElement {
	static get observedAttributes() {
		return ["id"];
	}
	static import(t, e) {
		if (t) {
			let n = Ct(t);
			return n && e ? n.querySelector(e) : n;
		}
		return null;
	}
	attributeChangedCallback(t, e, n, r) {
		e !== n && this.register();
	}
	get assetpath() {
		if (!this.__assetpath) {
			const t = this.ownerDocument, e = P$1(this.getAttribute("assetpath") || "", t.baseURI);
			this.__assetpath = C$1(e);
		}
		return this.__assetpath;
	}
	register(t) {
		if (t = t || this.id) {
			if (A$1 && void 0 !== Ct(t)) throw vt(t, null), /* @__PURE__ */ new Error(`strictTemplatePolicy: dom-module ${t} re-registered`);
			this.id = t, vt(t, this), (e = this).querySelector("style") && console.warn("dom-module %s has style outside template", e.id);
		}
		var e;
	}
};
wt.prototype.modules = bt, customElements.define("dom-module", wt);
var Et = "shady-unscoped";
function Tt(t) {
	return wt.import(t);
}
function Ot(t) {
	const e = v$1((t.body ? t.body : t).textContent, t.baseURI), n = document.createElement("style");
	return n.textContent = e, n;
}
function At(t) {
	const e = t.trim().split(/\s+/), n = [];
	for (let t = 0; t < e.length; t++) n.push(...Nt(e[t]));
	return n;
}
function Nt(t) {
	const e = Tt(t);
	if (!e) return console.warn("Could not find style data in module named", t), [];
	if (void 0 === e._styles) {
		const t = [];
		t.push(...St(e));
		const n = e.querySelector("template");
		n && t.push(...xt(n, e.assetpath)), e._styles = t;
	}
	return e._styles;
}
function xt(t, e) {
	if (!t._styles) {
		const n = [], r = t.content.querySelectorAll("style");
		for (let t = 0; t < r.length; t++) {
			let s = r[t], i = s.getAttribute("include");
			i && n.push(...At(i).filter((function(t, e, n) {
				return n.indexOf(t) === e;
			}))), e && (s.textContent = v$1(s.textContent, e)), n.push(s);
		}
		t._styles = n;
	}
	return t._styles;
}
function St(t) {
	const e = [], n = t.querySelectorAll("link[rel=import][type~=css]");
	for (let t = 0; t < n.length; t++) {
		let r = n[t];
		if (r.import) {
			const t = r.import, n = r.hasAttribute(Et);
			if (n && !t._unscopedStyle) {
				const e = Ot(t);
				e.setAttribute(Et, ""), t._unscopedStyle = e;
			} else t._style || (t._style = Ot(t));
			e.push(n ? t._unscopedStyle : t._style);
		}
	}
	return e;
}
function It(t) {
	let e = Tt(t);
	if (e && void 0 === e._cssText) {
		let t = function(t) {
			let e = "", n = St(t);
			for (let t = 0; t < n.length; t++) e += n[t].textContent;
			return e;
		}(e), n = e.querySelector("template");
		n && (t += function(t, e) {
			let n = "";
			const r = xt(t, e);
			for (let t = 0; t < r.length; t++) {
				let e = r[t];
				e.parentNode && e.parentNode.removeChild(e), n += e.textContent;
			}
			return n;
		}(n, e.assetpath)), e._cssText = t || null;
	}
	return e || console.warn("Could not find style data in module named", t), e && e._cssText || "";
}
function kt(t) {
	return t.indexOf(".") >= 0;
}
function Lt(t) {
	let e = t.indexOf(".");
	return -1 === e ? t : t.slice(0, e);
}
function Mt(t, e) {
	return 0 === t.indexOf(e + ".");
}
function Dt(t, e) {
	return 0 === e.indexOf(t + ".");
}
function Rt(t, e, n) {
	return e + n.slice(t.length);
}
function Ft(t, e) {
	return t === e || Mt(t, e) || Dt(t, e);
}
function Ht(t) {
	if (Array.isArray(t)) {
		let e = [];
		for (let n = 0; n < t.length; n++) {
			let r = t[n].toString().split(".");
			for (let t = 0; t < r.length; t++) e.push(r[t]);
		}
		return e.join(".");
	}
	return t;
}
function zt(t) {
	return Array.isArray(t) ? Ht(t).split(".") : t.toString().split(".");
}
function jt(t, e, n) {
	let r = t, s = zt(e);
	for (let t = 0; t < s.length; t++) {
		if (!r) return;
		r = r[s[t]];
	}
	return n && (n.path = s.join(".")), r;
}
function Bt(t, e, n) {
	let r = t, s = zt(e), i = s[s.length - 1];
	if (s.length > 1) {
		for (let t = 0; t < s.length - 1; t++) if (r = r[s[t]], !r) return;
		r[i] = n;
	} else r[e] = n;
	return s.join(".");
}
var Jt = {};
var qt = /-[a-z]/g;
var Yt = /([A-Z])/g;
function $t(t) {
	return Jt[t] || (Jt[t] = t.indexOf("-") < 0 ? t : t.replace(qt, ((t) => t[1].toUpperCase())));
}
function Ut(t) {
	return Jt[t] || (Jt[t] = t.replace(Yt, "-$1").toLowerCase());
}
var Vt = h;
var Xt = d$2(((t) => class extends t {
	static createProperties(t) {
		const e = this.prototype;
		for (let n in t) n in e || e._createPropertyAccessor(n);
	}
	static attributeNameForProperty(t) {
		return t.toLowerCase();
	}
	static typeForProperty(t) {}
	_createPropertyAccessor(t, e) {
		this._addPropertyToAttributeMap(t), this.hasOwnProperty(JSCompiler_renameProperty("__dataHasAccessor", this)) || (this.__dataHasAccessor = Object.assign({}, this.__dataHasAccessor)), this.__dataHasAccessor[t] || (this.__dataHasAccessor[t] = !0, this._definePropertyAccessor(t, e));
	}
	_addPropertyToAttributeMap(t) {
		this.hasOwnProperty(JSCompiler_renameProperty("__dataAttributes", this)) || (this.__dataAttributes = Object.assign({}, this.__dataAttributes));
		let e = this.__dataAttributes[t];
		return e || (e = this.constructor.attributeNameForProperty(t), this.__dataAttributes[e] = t), e;
	}
	_definePropertyAccessor(t, e) {
		Object.defineProperty(this, t, {
			get() {
				return this.__data[t];
			},
			set: e ? function() {} : function(e) {
				this._setPendingProperty(t, e, !0) && this._invalidateProperties();
			}
		});
	}
	constructor() {
		super(), this.__dataEnabled = !1, this.__dataReady = !1, this.__dataInvalid = !1, this.__data = {}, this.__dataPending = null, this.__dataOld = null, this.__dataInstanceProps = null, this.__dataCounter = 0, this.__serializing = !1, this._initializeProperties();
	}
	ready() {
		this.__dataReady = !0, this._flushProperties();
	}
	_initializeProperties() {
		for (let t in this.__dataHasAccessor) this.hasOwnProperty(t) && (this.__dataInstanceProps = this.__dataInstanceProps || {}, this.__dataInstanceProps[t] = this[t], delete this[t]);
	}
	_initializeInstanceProperties(t) {
		Object.assign(this, t);
	}
	_setProperty(t, e) {
		this._setPendingProperty(t, e) && this._invalidateProperties();
	}
	_getProperty(t) {
		return this.__data[t];
	}
	_setPendingProperty(t, e, n) {
		let r = this.__data[t], s = this._shouldPropertyChange(t, e, r);
		return s && (this.__dataPending || (this.__dataPending = {}, this.__dataOld = {}), this.__dataOld && !(t in this.__dataOld) && (this.__dataOld[t] = r), this.__data[t] = e, this.__dataPending[t] = e), s;
	}
	_isPropertyPending(t) {
		return !(!this.__dataPending || !this.__dataPending.hasOwnProperty(t));
	}
	_invalidateProperties() {
		!this.__dataInvalid && this.__dataReady && (this.__dataInvalid = !0, Vt.run((() => {
			this.__dataInvalid && (this.__dataInvalid = !1, this._flushProperties());
		})));
	}
	_enableProperties() {
		this.__dataEnabled || (this.__dataEnabled = !0, this.__dataInstanceProps && (this._initializeInstanceProperties(this.__dataInstanceProps), this.__dataInstanceProps = null), this.ready());
	}
	_flushProperties() {
		this.__dataCounter++;
		const t = this.__data, e = this.__dataPending, n = this.__dataOld;
		this._shouldPropertiesChange(t, e, n) && (this.__dataPending = null, this.__dataOld = null, this._propertiesChanged(t, e, n)), this.__dataCounter--;
	}
	_shouldPropertiesChange(t, e, n) {
		return Boolean(e);
	}
	_propertiesChanged(t, e, n) {}
	_shouldPropertyChange(t, e, n) {
		return n !== e && (n == n || e == e);
	}
	attributeChangedCallback(t, e, n, r) {
		e !== n && this._attributeToProperty(t, n), super.attributeChangedCallback && super.attributeChangedCallback(t, e, n, r);
	}
	_attributeToProperty(t, e, n) {
		if (!this.__serializing) {
			const r = this.__dataAttributes, s = r && r[t] || t;
			this[s] = this._deserializeValue(e, n || this.constructor.typeForProperty(s));
		}
	}
	_propertyToAttribute(t, e, n) {
		this.__serializing = !0, n = arguments.length < 3 ? this[t] : n, this._valueToNodeAttribute(this, n, e || this.constructor.attributeNameForProperty(t)), this.__serializing = !1;
	}
	_valueToNodeAttribute(t, e, n) {
		const r = this._serializeValue(e);
		"class" !== n && "name" !== n && "slot" !== n || (t = I$1(t)), void 0 === r ? t.removeAttribute(n) : t.setAttribute(n, r);
	}
	_serializeValue(t) {
		return "boolean" == typeof t ? t ? "" : void 0 : null != t ? t.toString() : void 0;
	}
	_deserializeValue(t, e) {
		switch (e) {
			case Boolean: return null !== t;
			case Number: return Number(t);
			default: return t;
		}
	}
}));
var Gt = {};
var Wt = HTMLElement.prototype;
for (; Wt;) {
	let t = Object.getOwnPropertyNames(Wt);
	for (let e = 0; e < t.length; e++) Gt[t[e]] = !0;
	Wt = Object.getPrototypeOf(Wt);
}
var Zt = window.trustedTypes ? (t) => trustedTypes.isHTML(t) || trustedTypes.isScript(t) || trustedTypes.isScriptURL(t) : () => !1;
var Kt = d$2(((t) => {
	const e = Xt(t);
	return class extends e {
		static createPropertiesForAttributes() {
			let t = this.observedAttributes;
			for (let e = 0; e < t.length; e++) this.prototype._createPropertyAccessor($t(t[e]));
		}
		static attributeNameForProperty(t) {
			return Ut(t);
		}
		_initializeProperties() {
			this.__dataProto && (this._initializeProtoProperties(this.__dataProto), this.__dataProto = null), super._initializeProperties();
		}
		_initializeProtoProperties(t) {
			for (let e in t) this._setProperty(e, t[e]);
		}
		_ensureAttribute(t, e) {
			const n = this;
			n.hasAttribute(t) || this._valueToNodeAttribute(n, e, t);
		}
		_serializeValue(t) {
			if ("object" == typeof t) {
				if (t instanceof Date) return t.toString();
				if (t) {
					if (Zt(t)) return t;
					try {
						return JSON.stringify(t);
					} catch (t) {
						return "";
					}
				}
			}
			return super._serializeValue(t);
		}
		_deserializeValue(t, e) {
			let n;
			switch (e) {
				case Object:
					try {
						n = JSON.parse(t);
					} catch (e) {
						n = t;
					}
					break;
				case Array:
					try {
						n = JSON.parse(t);
					} catch (e) {
						n = null, console.warn(`Polymer::Attributes: couldn't decode Array as JSON: ${t}`);
					}
					break;
				case Date:
					n = isNaN(t) ? String(t) : Number(t), n = new Date(n);
					break;
				default: n = super._deserializeValue(t, e);
			}
			return n;
		}
		_definePropertyAccessor(t, e) {
			(function(t, e) {
				if (!Gt[e]) {
					let n = t[e];
					void 0 !== n && (t.__data ? t._setPendingProperty(e, n) : (t.__dataProto ? t.hasOwnProperty(JSCompiler_renameProperty("__dataProto", t)) || (t.__dataProto = Object.create(t.__dataProto)) : t.__dataProto = {}, t.__dataProto[e] = n));
				}
			})(this, t), super._definePropertyAccessor(t, e);
		}
		_hasAccessor(t) {
			return this.__dataHasAccessor && this.__dataHasAccessor[t];
		}
		_isPropertyPending(t) {
			return Boolean(this.__dataPending && t in this.__dataPending);
		}
	};
}));
var Qt = {
	"dom-if": !0,
	"dom-repeat": !0
};
var te = !1;
var ee = !1;
function ne(t) {
	(function() {
		if (!te) {
			te = !0;
			const t = document.createElement("textarea");
			t.placeholder = "a", ee = t.placeholder === t.textContent;
		}
		return ee;
	})() && "textarea" === t.localName && t.placeholder && t.placeholder === t.textContent && (t.textContent = null);
}
var re = (() => {
	const t = window.trustedTypes && window.trustedTypes.createPolicy("polymer-template-event-attribute-policy", { createScript: (t) => t });
	return (e, n, r) => {
		const s = n.getAttribute(r);
		t && r.startsWith("on-") ? e.setAttribute(r, t.createScript(s, r)) : e.setAttribute(r, s);
	};
})();
function se(t) {
	let e = t.getAttribute("is");
	if (e && Qt[e]) {
		let n = t;
		for (n.removeAttribute("is"), t = n.ownerDocument.createElement(e), n.parentNode.replaceChild(t, n), t.appendChild(n); n.attributes.length;) {
			const { name: e } = n.attributes[0];
			re(t, n, e), n.removeAttribute(e);
		}
	}
	return t;
}
function ie(t, e) {
	let n = e.parentInfo && ie(t, e.parentInfo);
	if (!n) return t;
	for (let t = n.firstChild, r = 0; t; t = t.nextSibling) if (e.parentIndex === r++) return t;
}
function oe(t, e, n, r) {
	r.id && (e[r.id] = n);
}
function ae(t, e, n) {
	if (n.events && n.events.length) for (let r, s = 0, i = n.events; s < i.length && (r = i[s]); s++) t._addMethodEventListenerToNode(e, r.name, r.value, t);
}
function le(t, e, n, r) {
	n.templateInfo && (e._templateInfo = n.templateInfo, e._parentTemplateInfo = r);
}
var he = d$2(((t) => class extends t {
	static _parseTemplate(t, e) {
		if (!t._templateInfo) {
			let n = t._templateInfo = {};
			n.nodeInfoList = [], n.nestedTemplate = Boolean(e), n.stripWhiteSpace = !0, this._parseTemplateContent(t, n, { parent: null });
		}
		return t._templateInfo;
	}
	static _parseTemplateContent(t, e, n) {
		return this._parseTemplateNode(t.content, e, n);
	}
	static _parseTemplateNode(t, e, n) {
		let r = !1, s = t;
		return "template" != s.localName || s.hasAttribute("preserve-content") ? "slot" === s.localName && (e.hasInsertionPoint = !0) : r = this._parseTemplateNestedTemplate(s, e, n) || r, ne(s), s.firstChild && this._parseTemplateChildNodes(s, e, n), s.hasAttributes && s.hasAttributes() && (r = this._parseTemplateNodeAttributes(s, e, n) || r), r || n.noted;
	}
	static _parseTemplateChildNodes(t, e, n) {
		if ("script" !== t.localName && "style" !== t.localName) for (let r, s = t.firstChild, i = 0; s; s = r) {
			if ("template" == s.localName && (s = se(s)), r = s.nextSibling, s.nodeType === Node.TEXT_NODE) {
				let n = r;
				for (; n && n.nodeType === Node.TEXT_NODE;) s.textContent += n.textContent, r = n.nextSibling, t.removeChild(n), n = r;
				if (e.stripWhiteSpace && !s.textContent.trim()) {
					t.removeChild(s);
					continue;
				}
			}
			let o = {
				parentIndex: i,
				parentInfo: n
			};
			this._parseTemplateNode(s, e, o) && (o.infoIndex = e.nodeInfoList.push(o) - 1), s.parentNode && i++;
		}
	}
	static _parseTemplateNestedTemplate(t, e, n) {
		let r = t, s = this._parseTemplate(r, e);
		return (s.content = r.content.ownerDocument.createDocumentFragment()).appendChild(r.content), n.templateInfo = s, !0;
	}
	static _parseTemplateNodeAttributes(t, e, n) {
		let r = !1, s = Array.from(t.attributes);
		for (let i, o = s.length - 1; i = s[o]; o--) r = this._parseTemplateNodeAttribute(t, e, n, i.name, i.value) || r;
		return r;
	}
	static _parseTemplateNodeAttribute(t, e, n, r, s) {
		return "on-" === r.slice(0, 3) ? (t.removeAttribute(r), n.events = n.events || [], n.events.push({
			name: r.slice(3),
			value: s
		}), !0) : "id" === r && (n.id = s, !0);
	}
	static _contentForTemplate(t) {
		let e = t._templateInfo;
		return e && e.content || t.content;
	}
	_stampTemplate(t, e) {
		t && !t.content && window.HTMLTemplateElement && HTMLTemplateElement.decorate && HTMLTemplateElement.decorate(t);
		let n = (e = e || this.constructor._parseTemplate(t)).nodeInfoList, r = e.content || t.content, s = document.importNode(r, !0);
		s.__noInsertionPoint = !e.hasInsertionPoint;
		let i = s.nodeList = new Array(n.length);
		s.$ = {};
		for (let t, r = 0, o = n.length; r < o && (t = n[r]); r++) {
			let n = i[r] = ie(s, t);
			oe(0, s.$, n, t), le(0, n, t, e), ae(this, n, t);
		}
		return s;
	}
	_addMethodEventListenerToNode(t, e, n, r) {
		let s = function(t, e, n) {
			return t = t._methodHost || t, function(e) {
				t[n] ? t[n](e, e.detail) : console.warn("listener method `" + n + "` not defined");
			};
		}(r = r || t, 0, n);
		return this._addEventListenerToNode(t, e, s), s;
	}
	_addEventListenerToNode(t, e, n) {
		t.addEventListener(e, n);
	}
	_removeEventListenerFromNode(t, e, n) {
		t.removeEventListener(e, n);
	}
}));
var ce = 0;
var de = [];
var _e = {
	COMPUTE: "__computeEffects",
	REFLECT: "__reflectEffects",
	NOTIFY: "__notifyEffects",
	PROPAGATE: "__propagateEffects",
	OBSERVE: "__observeEffects",
	READ_ONLY: "__readOnly"
};
var ue = "__computeInfo";
var pe = /[A-Z]/;
function fe(t, e, n) {
	let r = t[e];
	if (r) {
		if (!t.hasOwnProperty(e) && (r = t[e] = Object.create(t[e]), n)) for (let t in r) {
			let e = r[t], n = r[t] = Array(e.length);
			for (let t = 0; t < e.length; t++) n[t] = e[t];
		}
	} else r = t[e] = {};
	return r;
}
function me(t, e, n, r, s, i) {
	if (e) {
		let o = !1;
		const a = ce++;
		for (let l in n) {
			let h = e[s ? Lt(l) : l];
			if (h) for (let e, c = 0, d = h.length; c < d && (e = h[c]); c++) e.info && e.info.lastRun === a || s && !ge(l, e.trigger) || (e.info && (e.info.lastRun = a), e.fn(t, l, n, r, e.info, s, i), o = !0);
		}
		return o;
	}
	return !1;
}
function ye(t, e, n, r, s, i, o, a) {
	let l = !1, h = e[o ? Lt(r) : r];
	if (h) for (let e, c = 0, d = h.length; c < d && (e = h[c]); c++) e.info && e.info.lastRun === n || o && !ge(r, e.trigger) || (e.info && (e.info.lastRun = n), e.fn(t, r, s, i, e.info, o, a), l = !0);
	return l;
}
function ge(t, e) {
	if (e) {
		let n = e.name;
		return n == t || !(!e.structured || !Mt(n, t)) || !(!e.wildcard || !Dt(n, t));
	}
	return !0;
}
function be(t, e, n, r, s) {
	let i = "string" == typeof s.method ? t[s.method] : s.method, o = s.property;
	i ? i.call(t, t.__data[o], r[o]) : s.dynamicFn || console.warn("observer method `" + s.method + "` not defined");
}
function Pe(t, e, n) {
	let r = Lt(e);
	if (r !== e) return ve(t, Ut(r) + "-changed", n[e], e), !0;
	return !1;
}
function ve(t, e, n, r) {
	let s = {
		value: n,
		queueProperty: !0
	};
	r && (s.path = r), I$1(t).dispatchEvent(new CustomEvent(e, { detail: s }));
}
function Ce(t, e, n, r, s, i) {
	let o = (i ? Lt(e) : e) != e ? e : null, a = o ? jt(t, o) : t.__data[e];
	o && void 0 === a && (a = n[e]), ve(t, s.eventName, a, o);
}
function we(t, e, n, r, s) {
	let i = t.__data[e];
	T$1 && (i = T$1(i, s.attrName, "attribute", t)), t._propertyToAttribute(e, s.attrName, i);
}
function Ee(t, e, n, r) {
	let s = t[_e.COMPUTE];
	if (s) if (S$2) {
		ce++;
		const i = function(t) {
			let e = t.constructor.__orderedComputedDeps;
			if (!e) {
				e = /* @__PURE__ */ new Map();
				const n = t[_e.COMPUTE];
				let r, { counts: s, ready: i, total: o } = function(t) {
					const e = t[ue], n = {}, r = t[_e.COMPUTE], s = [];
					let i = 0;
					for (let t in e) {
						const r = e[t];
						i += n[t] = r.args.filter(((t) => !t.literal)).length + (r.dynamicFn ? 1 : 0);
					}
					for (let t in r) e[t] || s.push(t);
					return {
						counts: n,
						ready: s,
						total: i
					};
				}(t);
				for (; r = i.shift();) {
					e.set(r, e.size);
					const t = n[r];
					t && t.forEach(((t) => {
						const e = t.info.methodInfo;
						--o, 0 == --s[e] && i.push(e);
					}));
				}
				if (0 !== o) console.warn(`Computed graph for ${t.localName} incomplete; circular?`);
				t.constructor.__orderedComputedDeps = e;
			}
			return e;
		}(t), o = [];
		for (let t in e) Oe(t, s, o, i, r);
		let a;
		for (; a = o.shift();) Ae(t, "", e, n, a) && Oe(a.methodInfo, s, o, i, r);
		Object.assign(n, t.__dataOld), Object.assign(e, t.__dataPending), t.__dataPending = null;
	} else {
		let i = e;
		for (; me(t, s, i, n, r);) Object.assign(n, t.__dataOld), Object.assign(e, t.__dataPending), i = t.__dataPending, t.__dataPending = null;
	}
}
var Te = (t, e, n) => {
	let r = 0, s = e.length - 1, i = -1;
	for (; r <= s;) {
		const o = r + s >> 1, a = n.get(e[o].methodInfo) - n.get(t.methodInfo);
		if (a < 0) r = o + 1;
		else {
			if (!(a > 0)) {
				i = o;
				break;
			}
			s = o - 1;
		}
	}
	i < 0 && (i = s + 1), e.splice(i, 0, t);
};
var Oe = (t, e, n, r, s) => {
	const i = e[s ? Lt(t) : t];
	if (i) for (let e = 0; e < i.length; e++) {
		const o = i[e];
		o.info.lastRun === ce || s && !ge(t, o.trigger) || (o.info.lastRun = ce, Te(o.info, n, r));
	}
};
function Ae(t, e, n, r, s) {
	let i = Me(t, e, n, r, s);
	if (i === de) return !1;
	let o = s.methodInfo;
	return t.__dataHasAccessor && t.__dataHasAccessor[o] ? t._setPendingProperty(o, i, !0) : (t[o] = i, !1);
}
function Ne(t, e, n, r, s, i, o) {
	n.bindings = n.bindings || [];
	let a = {
		kind: r,
		target: s,
		parts: i,
		literal: o,
		isCompound: 1 !== i.length
	};
	if (n.bindings.push(a), function(t) {
		return Boolean(t.target) && "attribute" != t.kind && "text" != t.kind && !t.isCompound && "{" === t.parts[0].mode;
	}(a)) {
		let { event: t, negate: e } = a.parts[0];
		a.listenerEvent = t || Ut(s) + "-changed", a.listenerNegate = e;
	}
	let l = e.nodeInfoList.length;
	for (let n = 0; n < a.parts.length; n++) {
		let r = a.parts[n];
		r.compoundIndex = n, xe(t, e, a, r, l);
	}
}
function xe(t, e, n, r, s) {
	if (!r.literal) if ("attribute" === n.kind && "-" === n.target[0]) console.warn("Cannot set attribute " + n.target + " because \"-\" is not a valid attribute starting character");
	else {
		let i = r.dependencies, o = {
			index: s,
			binding: n,
			part: r,
			evaluator: t
		};
		for (let n = 0; n < i.length; n++) {
			let r = i[n];
			"string" == typeof r && (r = Be(r), r.wildcard = !0), t._addTemplatePropertyEffect(e, r.rootProperty, {
				fn: Se,
				info: o,
				trigger: r
			});
		}
	}
}
function Se(t, e, n, r, s, i, o) {
	let a = o[s.index], l = s.binding, h = s.part;
	if (i && h.source && e.length > h.source.length && "property" == l.kind && !l.isCompound && a.__isPropertyEffectsClient && a.__dataHasAccessor && a.__dataHasAccessor[l.target]) {
		let r = n[e];
		e = Rt(h.source, l.target, e), a._setPendingPropertyOrPath(e, r, !1, !0) && t._enqueueClient(a);
	} else {
		let o = s.evaluator._evaluateBinding(t, h, e, n, r, i);
		o !== de && function(t, e, n, r, s) {
			s = function(t, e, n, r) {
				if (n.isCompound) {
					let s = t.__dataCompoundStorage[n.target];
					s[r.compoundIndex] = e, e = s.join("");
				}
				"attribute" !== n.kind && ("textContent" !== n.target && ("value" !== n.target || "input" !== t.localName && "textarea" !== t.localName) || (e = null == e ? "" : e));
				return e;
			}(e, s, n, r), T$1 && (s = T$1(s, n.target, n.kind, e));
			if ("attribute" == n.kind) t._valueToNodeAttribute(e, s, n.target);
			else {
				let r = n.target;
				e.__isPropertyEffectsClient && e.__dataHasAccessor && e.__dataHasAccessor[r] ? e[_e.READ_ONLY] && e[_e.READ_ONLY][r] || e._setPendingProperty(r, s) && t._enqueueClient(e) : t._setUnmanagedPropertyToNode(e, r, s);
			}
		}(t, a, l, h, o);
	}
}
function Ie(t, e) {
	if (e.isCompound) {
		let n = t.__dataCompoundStorage || (t.__dataCompoundStorage = {}), r = e.parts, s = new Array(r.length);
		for (let t = 0; t < r.length; t++) s[t] = r[t].literal;
		let i = e.target;
		n[i] = s, e.literal && "property" == e.kind && ("className" === i && (t = I$1(t)), t[i] = e.literal);
	}
}
function ke(t, e, n) {
	if (n.listenerEvent) {
		let r = n.parts[0];
		t.addEventListener(n.listenerEvent, (function(t) {
			(function(t, e, n, r, s) {
				let i, o = t.detail, a = o && o.path;
				a ? (r = Rt(n, r, a), i = o && o.value) : i = t.currentTarget[n], i = s ? !i : i, e[_e.READ_ONLY] && e[_e.READ_ONLY][r] || !e._setPendingPropertyOrPath(r, i, !0, Boolean(a)) || o && o.queueProperty || e._invalidateProperties();
			})(t, e, n.target, r.source, r.negate);
		}));
	}
}
function Le(t, e, n, r, s, i) {
	i = e.static || i && ("object" != typeof i || i[e.methodName]);
	let o = {
		methodName: e.methodName,
		args: e.args,
		methodInfo: s,
		dynamicFn: i
	};
	for (let s, i = 0; i < e.args.length && (s = e.args[i]); i++) s.literal || t._addPropertyEffect(s.rootProperty, n, {
		fn: r,
		info: o,
		trigger: s
	});
	return i && t._addPropertyEffect(e.methodName, n, {
		fn: r,
		info: o
	}), o;
}
function Me(t, e, n, r, s) {
	let i = t._methodHost || t, o = i[s.methodName];
	if (o) {
		let r = t._marshalArgs(s.args, e, n);
		return r === de ? de : o.apply(i, r);
	}
	s.dynamicFn || console.warn("method `" + s.methodName + "` not defined");
}
var De = [];
var He = /* @__PURE__ */ new RegExp("(\\[\\[|{{)\\s*(?:(!)\\s*)?((?:[a-zA-Z_$][\\w.:$\\-*]*)\\s*(?:\\(\\s*(?:(?:(?:((?:[a-zA-Z_$][\\w.:$\\-*]*)|(?:[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)|(?:(?:'(?:[^'\\\\]|\\\\.)*')|(?:\"(?:[^\"\\\\]|\\\\.)*\")))\\s*)(?:,\\s*(?:((?:[a-zA-Z_$][\\w.:$\\-*]*)|(?:[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)|(?:(?:'(?:[^'\\\\]|\\\\.)*')|(?:\"(?:[^\"\\\\]|\\\\.)*\")))\\s*))*)?)\\)\\s*)?)(?:]]|}})", "g");
function ze(t) {
	let e = "";
	for (let n = 0; n < t.length; n++) e += t[n].literal || "";
	return e;
}
function je(t) {
	let e = t.match(/([^\s]+?)\(([\s\S]*)\)/);
	if (e) {
		let t = {
			methodName: e[1],
			static: !0,
			args: De
		};
		if (e[2].trim()) return function(t, e) {
			return e.args = t.map((function(t) {
				let n = Be(t);
				return n.literal || (e.static = !1), n;
			}), this), e;
		}(e[2].replace(/\\,/g, "&comma;").split(","), t);
		return t;
	}
	return null;
}
function Be(t) {
	let e = t.trim().replace(/&comma;/g, ",").replace(/\\(.)/g, "$1"), n = {
		name: e,
		value: "",
		literal: !1
	}, r = e[0];
	switch ("-" === r && (r = e[1]), r >= "0" && r <= "9" && (r = "#"), r) {
		case "'":
		case "\"":
			n.value = e.slice(1, -1), n.literal = !0;
			break;
		case "#": n.value = Number(e), n.literal = !0;
	}
	return n.literal || (n.rootProperty = Lt(e), n.structured = kt(e), n.structured && (n.wildcard = ".*" == e.slice(-2), n.wildcard && (n.name = e.slice(0, -2)))), n;
}
function Je(t, e, n) {
	let r = jt(t, n);
	return void 0 === r && (r = e[n]), r;
}
function qe(t, e, n, r) {
	const s = { indexSplices: r };
	t.notifyPath(n + ".splices", s), t.notifyPath(n + ".length", e.length);
}
function Ye(t, e, n, r, s, i) {
	qe(t, e, n, [{
		index: r,
		addedCount: s,
		removed: i,
		object: e,
		type: "splice"
	}]);
}
var $e = d$2(((t) => {
	const e = he(Kt(t));
	return class extends e {
		constructor() {
			super(), this.__isPropertyEffectsClient = !0, this.__dataClientsReady, this.__dataPendingClients, this.__dataToNotify, this.__dataLinkedPaths, this.__dataHasPaths, this.__dataCompoundStorage, this.__dataHost, this.__dataTemp, this.__dataClientsInitialized, this.__data, this.__dataPending, this.__dataOld, this.__computeEffects, this.__computeInfo, this.__reflectEffects, this.__notifyEffects, this.__propagateEffects, this.__observeEffects, this.__readOnly, this.__templateInfo, this._overrideLegacyUndefined;
		}
		get PROPERTY_EFFECT_TYPES() {
			return _e;
		}
		_initializeProperties() {
			super._initializeProperties(), this._registerHost(), this.__dataClientsReady = !1, this.__dataPendingClients = null, this.__dataToNotify = null, this.__dataLinkedPaths = null, this.__dataHasPaths = !1, this.__dataCompoundStorage = this.__dataCompoundStorage || null, this.__dataHost = this.__dataHost || null, this.__dataTemp = {}, this.__dataClientsInitialized = !1;
		}
		_registerHost() {
			if (Ue.length) {
				let t = Ue[Ue.length - 1];
				t._enqueueClient(this), this.__dataHost = t;
			}
		}
		_initializeProtoProperties(t) {
			this.__data = Object.create(t), this.__dataPending = Object.create(t), this.__dataOld = {};
		}
		_initializeInstanceProperties(t) {
			let e = this[_e.READ_ONLY];
			for (let n in t) e && e[n] || (this.__dataPending = this.__dataPending || {}, this.__dataOld = this.__dataOld || {}, this.__data[n] = this.__dataPending[n] = t[n]);
		}
		_addPropertyEffect(t, e, n) {
			this._createPropertyAccessor(t, e == _e.READ_ONLY);
			let r = fe(this, e, !0)[t];
			r || (r = this[e][t] = []), r.push(n);
		}
		_removePropertyEffect(t, e, n) {
			let r = fe(this, e, !0)[t], s = r.indexOf(n);
			s >= 0 && r.splice(s, 1);
		}
		_hasPropertyEffect(t, e) {
			let n = this[e];
			return Boolean(n && n[t]);
		}
		_hasReadOnlyEffect(t) {
			return this._hasPropertyEffect(t, _e.READ_ONLY);
		}
		_hasNotifyEffect(t) {
			return this._hasPropertyEffect(t, _e.NOTIFY);
		}
		_hasReflectEffect(t) {
			return this._hasPropertyEffect(t, _e.REFLECT);
		}
		_hasComputedEffect(t) {
			return this._hasPropertyEffect(t, _e.COMPUTE);
		}
		_setPendingPropertyOrPath(t, e, n, r) {
			if (r || Lt(Array.isArray(t) ? t[0] : t) !== t) {
				if (!r) {
					let n = jt(this, t);
					if (!(t = Bt(this, t, e)) || !super._shouldPropertyChange(t, e, n)) return !1;
				}
				if (this.__dataHasPaths = !0, this._setPendingProperty(t, e, n)) return function(t, e, n) {
					let r = t.__dataLinkedPaths;
					if (r) {
						let s;
						for (let i in r) {
							let o = r[i];
							Dt(i, e) ? (s = Rt(i, o, e), t._setPendingPropertyOrPath(s, n, !0, !0)) : Dt(o, e) && (s = Rt(o, i, e), t._setPendingPropertyOrPath(s, n, !0, !0));
						}
					}
				}(this, t, e), !0;
			} else {
				if (this.__dataHasAccessor && this.__dataHasAccessor[t]) return this._setPendingProperty(t, e, n);
				this[t] = e;
			}
			return !1;
		}
		_setUnmanagedPropertyToNode(t, e, n) {
			n === t[e] && "object" != typeof n || ("className" === e && (t = I$1(t)), t[e] = n);
		}
		_setPendingProperty(t, e, n) {
			let r = this.__dataHasPaths && kt(t), s = r ? this.__dataTemp : this.__data;
			return !!this._shouldPropertyChange(t, e, s[t]) && (this.__dataPending || (this.__dataPending = {}, this.__dataOld = {}), t in this.__dataOld || (this.__dataOld[t] = this.__data[t]), r ? this.__dataTemp[t] = e : this.__data[t] = e, this.__dataPending[t] = e, (r || this[_e.NOTIFY] && this[_e.NOTIFY][t]) && (this.__dataToNotify = this.__dataToNotify || {}, this.__dataToNotify[t] = n), !0);
		}
		_setProperty(t, e) {
			this._setPendingProperty(t, e, !0) && this._invalidateProperties();
		}
		_invalidateProperties() {
			this.__dataReady && this._flushProperties();
		}
		_enqueueClient(t) {
			this.__dataPendingClients = this.__dataPendingClients || [], t !== this && this.__dataPendingClients.push(t);
		}
		_flushClients() {
			this.__dataClientsReady ? this.__enableOrFlushClients() : (this.__dataClientsReady = !0, this._readyClients(), this.__dataReady = !0);
		}
		__enableOrFlushClients() {
			let t = this.__dataPendingClients;
			if (t) {
				this.__dataPendingClients = null;
				for (let e = 0; e < t.length; e++) {
					let n = t[e];
					n.__dataEnabled ? n.__dataPending && n._flushProperties() : n._enableProperties();
				}
			}
		}
		_readyClients() {
			this.__enableOrFlushClients();
		}
		setProperties(t, e) {
			for (let n in t) !e && this[_e.READ_ONLY] && this[_e.READ_ONLY][n] || this._setPendingPropertyOrPath(n, t[n], !0);
			this._invalidateProperties();
		}
		ready() {
			this._flushProperties(), this.__dataClientsReady || this._flushClients(), this.__dataPending && this._flushProperties();
		}
		_propertiesChanged(t, e, n) {
			let r, s = this.__dataHasPaths;
			this.__dataHasPaths = !1, Ee(this, e, n, s), r = this.__dataToNotify, this.__dataToNotify = null, this._propagatePropertyChanges(e, n, s), this._flushClients(), me(this, this[_e.REFLECT], e, n, s), me(this, this[_e.OBSERVE], e, n, s), r && function(t, e, n, r, s) {
				let i, o, a = t[_e.NOTIFY], l = ce++;
				for (let o in e) e[o] && (a && ye(t, a, l, o, n, r, s) || s && Pe(t, o, n)) && (i = !0);
				i && (o = t.__dataHost) && o._invalidateProperties && o._invalidateProperties();
			}(this, r, e, n, s), 1 == this.__dataCounter && (this.__dataTemp = {});
		}
		_propagatePropertyChanges(t, e, n) {
			this[_e.PROPAGATE] && me(this, this[_e.PROPAGATE], t, e, n), this.__templateInfo && this._runEffectsForTemplate(this.__templateInfo, t, e, n);
		}
		_runEffectsForTemplate(t, e, n, r) {
			const s = (e, r) => {
				me(this, t.propertyEffects, e, n, r, t.nodeList);
				for (let s = t.firstChild; s; s = s.nextSibling) this._runEffectsForTemplate(s, e, n, r);
			};
			t.runEffects ? t.runEffects(s, e, r) : s(e, r);
		}
		linkPaths(t, e) {
			t = Ht(t), e = Ht(e), this.__dataLinkedPaths = this.__dataLinkedPaths || {}, this.__dataLinkedPaths[t] = e;
		}
		unlinkPaths(t) {
			t = Ht(t), this.__dataLinkedPaths && delete this.__dataLinkedPaths[t];
		}
		notifySplices(t, e) {
			let n = { path: "" };
			qe(this, jt(this, t, n), n.path, e);
		}
		get(t, e) {
			return jt(e || this, t);
		}
		set(t, e, n) {
			n ? Bt(n, t, e) : this[_e.READ_ONLY] && this[_e.READ_ONLY][t] || this._setPendingPropertyOrPath(t, e, !0) && this._invalidateProperties();
		}
		push(t, ...e) {
			let n = { path: "" }, r = jt(this, t, n), s = r.length, i = r.push(...e);
			return e.length && Ye(this, r, n.path, s, e.length, []), i;
		}
		pop(t) {
			let e = { path: "" }, n = jt(this, t, e), r = Boolean(n.length), s = n.pop();
			return r && Ye(this, n, e.path, n.length, 0, [s]), s;
		}
		splice(t, e, n, ...r) {
			let s, i = { path: "" }, o = jt(this, t, i);
			return e < 0 ? e = o.length - Math.floor(-e) : e && (e = Math.floor(e)), s = 2 === arguments.length ? o.splice(e) : o.splice(e, n, ...r), (r.length || s.length) && Ye(this, o, i.path, e, r.length, s), s;
		}
		shift(t) {
			let e = { path: "" }, n = jt(this, t, e), r = Boolean(n.length), s = n.shift();
			return r && Ye(this, n, e.path, 0, 0, [s]), s;
		}
		unshift(t, ...e) {
			let n = { path: "" }, r = jt(this, t, n), s = r.unshift(...e);
			return e.length && Ye(this, r, n.path, 0, e.length, []), s;
		}
		notifyPath(t, e) {
			let n;
			if (1 == arguments.length) {
				let r = { path: "" };
				e = jt(this, t, r), n = r.path;
			} else n = Array.isArray(t) ? Ht(t) : t;
			this._setPendingPropertyOrPath(n, e, !0, !0) && this._invalidateProperties();
		}
		_createReadOnlyProperty(t, e) {
			var n;
			this._addPropertyEffect(t, _e.READ_ONLY), e && (this["_set" + (n = t, n[0].toUpperCase() + n.substring(1))] = function(e) {
				this._setProperty(t, e);
			});
		}
		_createPropertyObserver(t, e, n) {
			let r = {
				property: t,
				method: e,
				dynamicFn: Boolean(n)
			};
			this._addPropertyEffect(t, _e.OBSERVE, {
				fn: be,
				info: r,
				trigger: { name: t }
			}), n && this._addPropertyEffect(e, _e.OBSERVE, {
				fn: be,
				info: r,
				trigger: { name: e }
			});
		}
		_createMethodObserver(t, e) {
			let n = je(t);
			if (!n) throw new Error("Malformed observer expression '" + t + "'");
			Le(this, n, _e.OBSERVE, Me, null, e);
		}
		_createNotifyingProperty(t) {
			this._addPropertyEffect(t, _e.NOTIFY, {
				fn: Ce,
				info: {
					eventName: Ut(t) + "-changed",
					property: t
				}
			});
		}
		_createReflectedProperty(t) {
			let e = this.constructor.attributeNameForProperty(t);
			"-" === e[0] ? console.warn("Property " + t + " cannot be reflected to attribute " + e + " because \"-\" is not a valid starting attribute name. Use a lowercase first letter for the property instead.") : this._addPropertyEffect(t, _e.REFLECT, {
				fn: we,
				info: { attrName: e }
			});
		}
		_createComputedProperty(t, e, n) {
			let r = je(e);
			if (!r) throw new Error("Malformed computed expression '" + e + "'");
			const s = Le(this, r, _e.COMPUTE, Ae, t, n);
			fe(this, ue)[t] = s;
		}
		_marshalArgs(t, e, n) {
			const r = this.__data, s = [];
			for (let i = 0, o = t.length; i < o; i++) {
				let { name: o, structured: a, wildcard: l, value: h, literal: c } = t[i];
				if (!c) if (l) {
					const t = Dt(o, e), s = Je(r, n, t ? e : o);
					h = {
						path: t ? e : o,
						value: s,
						base: t ? jt(r, o) : s
					};
				} else h = a ? Je(r, n, o) : r[o];
				s[i] = h;
			}
			return s;
		}
		static addPropertyEffect(t, e, n) {
			this.prototype._addPropertyEffect(t, e, n);
		}
		static createPropertyObserver(t, e, n) {
			this.prototype._createPropertyObserver(t, e, n);
		}
		static createMethodObserver(t, e) {
			this.prototype._createMethodObserver(t, e);
		}
		static createNotifyingProperty(t) {
			this.prototype._createNotifyingProperty(t);
		}
		static createReadOnlyProperty(t, e) {
			this.prototype._createReadOnlyProperty(t, e);
		}
		static createReflectedProperty(t) {
			this.prototype._createReflectedProperty(t);
		}
		static createComputedProperty(t, e, n) {
			this.prototype._createComputedProperty(t, e, n);
		}
		static bindTemplate(t) {
			return this.prototype._bindTemplate(t);
		}
		_bindTemplate(t, e) {
			let n = this.constructor._parseTemplate(t), r = this.__preBoundTemplateInfo == n;
			if (!r) for (let t in n.propertyEffects) this._createPropertyAccessor(t);
			if (e) if (n = Object.create(n), n.wasPreBound = r, this.__templateInfo) {
				const e = t._parentTemplateInfo || this.__templateInfo, r = e.lastChild;
				n.parent = e, e.lastChild = n, n.previousSibling = r, r ? r.nextSibling = n : e.firstChild = n;
			} else this.__templateInfo = n;
			else this.__preBoundTemplateInfo = n;
			return n;
		}
		static _addTemplatePropertyEffect(t, e, n) {
			(t.hostProps = t.hostProps || {})[e] = !0;
			let r = t.propertyEffects = t.propertyEffects || {};
			(r[e] = r[e] || []).push(n);
		}
		_stampTemplate(t, e) {
			e = e || this._bindTemplate(t, !0), Ue.push(this);
			let n = super._stampTemplate(t, e);
			if (Ue.pop(), e.nodeList = n.nodeList, !e.wasPreBound) {
				let t = e.childNodes = [];
				for (let e = n.firstChild; e; e = e.nextSibling) t.push(e);
			}
			return n.templateInfo = e, function(t, e) {
				let { nodeList: n, nodeInfoList: r } = e;
				if (r.length) for (let e = 0; e < r.length; e++) {
					let s = r[e], i = n[e], o = s.bindings;
					if (o) for (let e = 0; e < o.length; e++) {
						let n = o[e];
						Ie(i, n), ke(i, t, n);
					}
					i.__dataHost = t;
				}
			}(this, e), this.__dataClientsReady && (this._runEffectsForTemplate(e, this.__data, null, !1), this._flushClients()), n;
		}
		_removeBoundDom(t) {
			const e = t.templateInfo, { previousSibling: n, nextSibling: r, parent: s } = e;
			n ? n.nextSibling = r : s && (s.firstChild = r), r ? r.previousSibling = n : s && (s.lastChild = n), e.nextSibling = e.previousSibling = null;
			let i = e.childNodes;
			for (let t = 0; t < i.length; t++) {
				let e = i[t];
				I$1(I$1(e).parentNode).removeChild(e);
			}
		}
		static _parseTemplateNode(t, n, r) {
			let s = e._parseTemplateNode.call(this, t, n, r);
			if (t.nodeType === Node.TEXT_NODE) {
				let e = this._parseBindings(t.textContent, n);
				e && (t.textContent = ze(e) || " ", Ne(this, n, r, "text", "textContent", e), s = !0);
			}
			return s;
		}
		static _parseTemplateNodeAttribute(t, n, r, s, i) {
			let o = this._parseBindings(i, n);
			if (o) {
				let e = s, i = "property";
				pe.test(s) ? i = "attribute" : "$" == s[s.length - 1] && (s = s.slice(0, -1), i = "attribute");
				let a = ze(o);
				return a && "attribute" == i && ("class" == s && t.hasAttribute("class") && (a += " " + t.getAttribute(s)), t.setAttribute(s, a)), "attribute" == i && "disable-upgrade$" == e && t.setAttribute(s, ""), "input" === t.localName && "value" === e && t.setAttribute(e, ""), t.removeAttribute(e), "property" === i && (s = $t(s)), Ne(this, n, r, i, s, o, a), !0;
			}
			return e._parseTemplateNodeAttribute.call(this, t, n, r, s, i);
		}
		static _parseTemplateNestedTemplate(t, n, r) {
			let s = e._parseTemplateNestedTemplate.call(this, t, n, r);
			const i = t.parentNode, o = r.templateInfo;
			i.localName, i.localName;
			let a = o.hostProps;
			{
				let t = "{";
				for (let e in a) Ne(this, n, r, "property", "_host_" + e, [{
					mode: t,
					source: e,
					dependencies: [e],
					hostProp: !0
				}]);
			}
			return s;
		}
		static _parseBindings(t, e) {
			let n, r = [], s = 0;
			for (; null !== (n = He.exec(t));) {
				n.index > s && r.push({ literal: t.slice(s, n.index) });
				let i = n[1][0], o = Boolean(n[2]), a = n[3].trim(), l = !1, h = "", c = -1;
				"{" == i && (c = a.indexOf("::")) > 0 && (h = a.substring(c + 2), a = a.substring(0, c), l = !0);
				let d = je(a), _ = [];
				if (d) {
					let { args: t, methodName: n } = d;
					for (let e = 0; e < t.length; e++) {
						let n = t[e];
						n.literal || _.push(n);
					}
					let r = e.dynamicFns;
					(r && r[n] || d.static) && (_.push(n), d.dynamicFn = !0);
				} else _.push(a);
				r.push({
					source: a,
					mode: i,
					negate: o,
					customEvent: l,
					signature: d,
					dependencies: _,
					event: h
				}), s = He.lastIndex;
			}
			if (s && s < t.length) {
				let e = t.substring(s);
				e && r.push({ literal: e });
			}
			return r.length ? r : null;
		}
		static _evaluateBinding(t, e, n, r, s, i) {
			let o;
			return o = e.signature ? Me(t, n, r, 0, e.signature) : n != e.source ? jt(t, e.source) : i && kt(n) ? jt(t, n) : t.__data[n], e.negate && (o = !o), o;
		}
	};
}));
var Ue = [];
var Ve = d$2(((t) => {
	const e = Xt(t);
	function n(t) {
		const e = Object.getPrototypeOf(t);
		return e.prototype instanceof s ? e : null;
	}
	function r(t) {
		if (!t.hasOwnProperty(JSCompiler_renameProperty("__ownProperties", t))) {
			let e = null;
			if (t.hasOwnProperty(JSCompiler_renameProperty("properties", t))) {
				const n = t.properties;
				n && (e = function(t) {
					const e = {};
					for (let n in t) {
						const r = t[n];
						e[n] = "function" == typeof r ? { type: r } : r;
					}
					return e;
				}(n));
			}
			t.__ownProperties = e;
		}
		return t.__ownProperties;
	}
	class s extends e {
		static get observedAttributes() {
			if (!this.hasOwnProperty(JSCompiler_renameProperty("__observedAttributes", this))) {
				this.prototype;
				const t = this._properties;
				this.__observedAttributes = t ? Object.keys(t).map(((t) => this.prototype._addPropertyToAttributeMap(t))) : [];
			}
			return this.__observedAttributes;
		}
		static finalize() {
			if (!this.hasOwnProperty(JSCompiler_renameProperty("__finalized", this))) {
				const t = n(this);
				t && t.finalize(), this.__finalized = !0, this._finalizeClass();
			}
		}
		static _finalizeClass() {
			const t = r(this);
			t && this.createProperties(t);
		}
		static get _properties() {
			if (!this.hasOwnProperty(JSCompiler_renameProperty("__properties", this))) {
				const t = n(this);
				this.__properties = Object.assign({}, t && t._properties, r(this));
			}
			return this.__properties;
		}
		static typeForProperty(t) {
			const e = this._properties[t];
			return e && e.type;
		}
		_initializeProperties() {
			this.constructor.finalize(), super._initializeProperties();
		}
		connectedCallback() {
			super.connectedCallback && super.connectedCallback(), this._enableProperties();
		}
		disconnectedCallback() {
			super.disconnectedCallback && super.disconnectedCallback();
		}
	}
	return s;
}));
var Xe = d$2(((t) => {
	const e = Ve($e(t));
	function n(t, e, n, r) {
		n.computed && (n.readOnly = !0), n.computed && (t._hasReadOnlyEffect(e) ? console.warn(`Cannot redefine computed property '${e}'.`) : t._createComputedProperty(e, n.computed, r)), n.readOnly && !t._hasReadOnlyEffect(e) ? t._createReadOnlyProperty(e, !n.computed) : !1 === n.readOnly && t._hasReadOnlyEffect(e) && console.warn(`Cannot make readOnly property '${e}' non-readOnly.`), n.reflectToAttribute && !t._hasReflectEffect(e) ? t._createReflectedProperty(e) : !1 === n.reflectToAttribute && t._hasReflectEffect(e) && console.warn(`Cannot make reflected property '${e}' non-reflected.`), n.notify && !t._hasNotifyEffect(e) ? t._createNotifyingProperty(e) : !1 === n.notify && t._hasNotifyEffect(e) && console.warn(`Cannot make notify property '${e}' non-notify.`), n.observer && t._createPropertyObserver(e, n.observer, r[n.observer]), t._addPropertyToAttributeMap(e);
	}
	function r(t, e, n, r) {
		{
			const s = e.content.querySelectorAll("style"), i = xt(e), o = function(t) {
				let e = Tt(t);
				return e ? St(e) : [];
			}(n), a = e.content.firstElementChild;
			for (let n = 0; n < o.length; n++) {
				let s = o[n];
				s.textContent = t._processStyleText(s.textContent, r), e.content.insertBefore(s, a);
			}
			let l = 0;
			for (let e = 0; e < i.length; e++) {
				let n = i[e], o = s[l];
				o !== n ? (n = n.cloneNode(!0), o.parentNode.insertBefore(n, o)) : l++, n.textContent = t._processStyleText(n.textContent, r);
			}
		}
	}
	return class extends e {
		static get polymerElementVersion() {
			return "3.5.0";
		}
		static _finalizeClass() {
			e._finalizeClass.call(this);
			const t = ((n = this).hasOwnProperty(JSCompiler_renameProperty("__ownObservers", n)) || (n.__ownObservers = n.hasOwnProperty(JSCompiler_renameProperty("observers", n)) ? n.observers : null), n.__ownObservers);
			var n;
			t && this.createObservers(t, this._properties), this._prepareTemplate();
		}
		static _prepareTemplate() {
			let t = this.template;
			t && ("string" == typeof t ? (console.error("template getter must return HTMLTemplateElement"), t = null) : t = t.cloneNode(!0)), this.prototype._template = t;
		}
		static createProperties(t) {
			for (let e in t) n(this.prototype, e, t[e], t);
		}
		static createObservers(t, e) {
			const n = this.prototype;
			for (let r = 0; r < t.length; r++) n._createMethodObserver(t[r], e);
		}
		static get template() {
			if (!this.hasOwnProperty(JSCompiler_renameProperty("_template", this))) {
				let t = this.prototype.hasOwnProperty(JSCompiler_renameProperty("_template", this.prototype)) ? this.prototype._template : void 0;
				"function" == typeof t && (t = t()), this._template = void 0 !== t ? t : this.hasOwnProperty(JSCompiler_renameProperty("is", this)) && function(t) {
					let e = null;
					if (t && (!A$1 || N$1) && (e = wt.import(t, "template"), A$1 && !e)) throw new Error(`strictTemplatePolicy: expecting dom-module or null template for ${t}`);
					return e;
				}(this.is) || Object.getPrototypeOf(this.prototype).constructor.template;
			}
			return this._template;
		}
		static set template(t) {
			this._template = t;
		}
		static get importPath() {
			if (!this.hasOwnProperty(JSCompiler_renameProperty("_importPath", this))) {
				const t = this.importMeta;
				if (t) this._importPath = C$1(t.url);
				else {
					const t = wt.import(this.is);
					this._importPath = t && t.assetpath || Object.getPrototypeOf(this.prototype).constructor.importPath;
				}
			}
			return this._importPath;
		}
		constructor() {
			super(), this._template, this._importPath, this.rootPath, this.importPath, this.root, this.$;
		}
		_initializeProperties() {
			this.constructor.finalize(), this.constructor._finalizeTemplate(this.localName), super._initializeProperties(), this.rootPath = E$1, this.importPath = this.constructor.importPath;
			let t = function(t) {
				if (!t.hasOwnProperty(JSCompiler_renameProperty("__propertyDefaults", t))) {
					t.__propertyDefaults = null;
					let e = t._properties;
					for (let n in e) {
						let r = e[n];
						"value" in r && (t.__propertyDefaults = t.__propertyDefaults || {}, t.__propertyDefaults[n] = r);
					}
				}
				return t.__propertyDefaults;
			}(this.constructor);
			if (t) for (let e in t) {
				let n = t[e];
				if (this._canApplyPropertyDefault(e)) {
					let t = "function" == typeof n.value ? n.value.call(this) : n.value;
					this._hasAccessor(e) ? this._setPendingProperty(e, t, !0) : this[e] = t;
				}
			}
		}
		_canApplyPropertyDefault(t) {
			return !this.hasOwnProperty(t);
		}
		static _processStyleText(t, e) {
			return v$1(t, e);
		}
		static _finalizeTemplate(t) {
			const e = this.prototype._template;
			if (e && !e.__polymerFinalized) {
				e.__polymerFinalized = !0;
				const n = this.importPath;
				r(this, e, t, n ? P$1(n) : ""), this.prototype._bindTemplate(e);
			}
		}
		connectedCallback() {
			super.connectedCallback();
		}
		ready() {
			this._template && (this.root = this._stampTemplate(this._template), this.$ = this.root.$), super.ready();
		}
		_readyClients() {
			this._template && (this.root = this._attachDom(this.root)), super._readyClients();
		}
		_attachDom(t) {
			const e = I$1(this);
			if (e.attachShadow) return t ? (e.shadowRoot || (e.attachShadow({
				mode: "open",
				shadyUpgradeFragment: t
			}), this.constructor._styleSheet && (e.shadowRoot.adoptedStyleSheets = [this.constructor._styleSheet])), e.shadowRoot.appendChild(t), e.shadowRoot) : null;
			throw new Error("ShadowDOM not available. PolymerElement can create dom as children instead of in ShadowDOM by setting `this.root = this;` before `ready`.");
		}
		updateStyles(t) {
			for (const [e, n] of Object.entries(t)) this.style.setProperty(e, n);
		}
		resolveUrl(t, e) {
			return !e && this.importPath && (e = P$1(this.importPath)), P$1(t, e);
		}
		static _parseTemplateContent(t, n, r) {
			return n.dynamicFns = n.dynamicFns || this._properties, e._parseTemplateContent.call(this, t, n, r);
		}
		static _addTemplatePropertyEffect(t, n, r) {
			return e._addTemplatePropertyEffect.call(this, t, n, r);
		}
	};
}));
var Ge = window.trustedTypes && trustedTypes.createPolicy("polymer-html-literal", { createHTML: (t) => t });
var We = class {
	constructor(t, e) {
		Qe(t, e);
		const n = e.reduce(((e, n, r) => e + Ze(n) + t[r + 1]), t[0]);
		this.value = n.toString();
	}
	toString() {
		return this.value;
	}
};
function Ze(t) {
	if (t instanceof We) return t.value;
	throw new Error(`non-literal value passed to Polymer's htmlLiteral function: ${t}`);
}
var Ke = function(t, ...e) {
	Qe(t, e);
	const n = document.createElement("template");
	let r = e.reduce(((e, n, r) => e + function(t) {
		if (t instanceof HTMLTemplateElement) return t.innerHTML;
		if (t instanceof We) return Ze(t);
		throw new Error(`non-template value passed to Polymer's html function: ${t}`);
	}(n) + t[r + 1]), t[0]);
	return Ge && (r = Ge.createHTML(r)), n.innerHTML = r, n;
};
var Qe = (t, e) => {
	if (!Array.isArray(t) || !Array.isArray(t.raw) || e.length !== t.length - 1) throw new TypeError("Invalid call to the html template tag");
};
var tn = Xe(HTMLElement);
function en(t, e, n) {
	return {
		index: t,
		removed: e,
		addedCount: n
	};
}
function nn(t, e, n, r, s, i) {
	let o, a = 0, l = 0, h = Math.min(n - e, i - s);
	if (0 == e && 0 == s && (a = function(t, e, n) {
		for (let r = 0; r < n; r++) if (!sn(t[r], e[r])) return r;
		return n;
	}(t, r, h)), n == t.length && i == r.length && (l = function(t, e, n) {
		let r = t.length, s = e.length, i = 0;
		for (; i < n && sn(t[--r], e[--s]);) i++;
		return i;
	}(t, r, h - a)), s += a, i -= l, (n -= l) - (e += a) == 0 && i - s == 0) return [];
	if (e == n) {
		for (o = en(e, [], 0); s < i;) o.removed.push(r[s++]);
		return [o];
	}
	if (s == i) return [en(e, [], n - e)];
	let c = function(t) {
		let e = t.length - 1, n = t[0].length - 1, r = t[e][n], s = [];
		for (; e > 0 || n > 0;) {
			if (0 == e) {
				s.push(2), n--;
				continue;
			}
			if (0 == n) {
				s.push(3), e--;
				continue;
			}
			let i, o = t[e - 1][n - 1], a = t[e - 1][n], l = t[e][n - 1];
			i = a < l ? a < o ? a : o : l < o ? l : o, i == o ? (o == r ? s.push(0) : (s.push(1), r = o), e--, n--) : i == a ? (s.push(3), e--, r = a) : (s.push(2), n--, r = l);
		}
		return s.reverse(), s;
	}(function(t, e, n, r, s, i) {
		let o = i - s + 1, a = n - e + 1, l = new Array(o);
		for (let t = 0; t < o; t++) l[t] = new Array(a), l[t][0] = t;
		for (let t = 0; t < a; t++) l[0][t] = t;
		for (let n = 1; n < o; n++) for (let i = 1; i < a; i++) if (sn(t[e + i - 1], r[s + n - 1])) l[n][i] = l[n - 1][i - 1];
		else {
			let t = l[n - 1][i] + 1, e = l[n][i - 1] + 1;
			l[n][i] = t < e ? t : e;
		}
		return l;
	}(t, e, n, r, s, i));
	o = void 0;
	let d = [], _ = e, u = s;
	for (let t = 0; t < c.length; t++) switch (c[t]) {
		case 0:
			o && (d.push(o), o = void 0), _++, u++;
			break;
		case 1:
			o || (o = en(_, [], 0)), o.addedCount++, _++, o.removed.push(r[u]), u++;
			break;
		case 2:
			o || (o = en(_, [], 0)), o.addedCount++, _++;
			break;
		case 3: o || (o = en(_, [], 0)), o.removed.push(r[u]), u++;
	}
	return o && d.push(o), d;
}
function rn(t, e) {
	return nn(t, 0, t.length, e, 0, e.length);
}
function sn(t, e) {
	return t === e;
}
var on = d$2(((t) => {
	let e = Xe(t);
	return class extends e {
		static get properties() {
			return {
				items: { type: Array },
				multi: {
					type: Boolean,
					value: !1
				},
				selected: {
					type: Object,
					notify: !0
				},
				selectedItem: {
					type: Object,
					notify: !0
				},
				toggle: {
					type: Boolean,
					value: !1
				}
			};
		}
		static get observers() {
			return ["__updateSelection(multi, items.*)"];
		}
		constructor() {
			super(), this.__lastItems = null, this.__lastMulti = null, this.__selectedMap = null;
		}
		__updateSelection(t, e) {
			let n = e.path;
			if (n == JSCompiler_renameProperty("items", this)) {
				let n = e.base || [], r = this.__lastItems;
				if (t !== this.__lastMulti && this.clearSelection(), r) {
					let t = rn(n, r);
					this.__applySplices(t);
				}
				this.__lastItems = n, this.__lastMulti = t;
			} else if (e.path == `${JSCompiler_renameProperty("items", this)}.splices`) this.__applySplices(e.value.indexSplices);
			else {
				let t = n.slice(`${JSCompiler_renameProperty("items", this)}.`.length), e = parseInt(t, 10);
				t.indexOf(".") < 0 && t == e && this.__deselectChangedIdx(e);
			}
		}
		__applySplices(t) {
			let e = this.__selectedMap;
			for (let n = 0; n < t.length; n++) {
				let r = t[n];
				e.forEach(((t, n) => {
					t < r.index || (t >= r.index + r.removed.length ? e.set(n, t + r.addedCount - r.removed.length) : e.set(n, -1));
				}));
				for (let t = 0; t < r.addedCount; t++) {
					let n = r.index + t;
					e.has(this.items[n]) && e.set(this.items[n], n);
				}
			}
			this.__updateLinks();
			let n = 0;
			e.forEach(((t, r) => {
				t < 0 ? (this.multi ? this.splice(JSCompiler_renameProperty("selected", this), n, 1) : this.selected = this.selectedItem = null, e.delete(r)) : n++;
			}));
		}
		__updateLinks() {
			if (this.__dataLinkedPaths = {}, this.multi) {
				let t = 0;
				this.__selectedMap.forEach(((e) => {
					e >= 0 && this.linkPaths(`${JSCompiler_renameProperty("items", this)}.${e}`, `${JSCompiler_renameProperty("selected", this)}.${t++}`);
				}));
			} else this.__selectedMap.forEach(((t) => {
				this.linkPaths(JSCompiler_renameProperty("selected", this), `${JSCompiler_renameProperty("items", this)}.${t}`), this.linkPaths(JSCompiler_renameProperty("selectedItem", this), `${JSCompiler_renameProperty("items", this)}.${t}`);
			}));
		}
		clearSelection() {
			this.__dataLinkedPaths = {}, this.__selectedMap = /* @__PURE__ */ new Map(), this.selected = this.multi ? [] : null, this.selectedItem = null;
		}
		isSelected(t) {
			return this.__selectedMap.has(t);
		}
		isIndexSelected(t) {
			return this.isSelected(this.items[t]);
		}
		__deselectChangedIdx(t) {
			let e = this.__selectedIndexForItemIndex(t);
			if (e >= 0) {
				let t = 0;
				this.__selectedMap.forEach(((n, r) => {
					e == t++ && this.deselect(r);
				}));
			}
		}
		__selectedIndexForItemIndex(t) {
			let e = this.__dataLinkedPaths[`${JSCompiler_renameProperty("items", this)}.${t}`];
			if (e) return parseInt(e.slice(`${JSCompiler_renameProperty("selected", this)}.`.length), 10);
		}
		deselect(t) {
			let e = this.__selectedMap.get(t);
			if (e >= 0) {
				let n;
				this.__selectedMap.delete(t), this.multi && (n = this.__selectedIndexForItemIndex(e)), this.__updateLinks(), this.multi ? this.splice(JSCompiler_renameProperty("selected", this), n, 1) : this.selected = this.selectedItem = null;
			}
		}
		deselectIndex(t) {
			this.deselect(this.items[t]);
		}
		select(t) {
			this.selectIndex(this.items.indexOf(t));
		}
		selectIndex(t) {
			let e = this.items[t];
			this.isSelected(e) ? this.toggle && this.deselectIndex(t) : (this.multi || this.__selectedMap.clear(), this.__selectedMap.set(e, t), this.__updateLinks(), this.multi ? this.push(JSCompiler_renameProperty("selected", this), e) : this.selected = this.selectedItem = e);
		}
	};
}))(tn);
var an = class extends on {
	static get is() {
		return "array-selector";
	}
	static get template() {
		return null;
	}
};
customElements.define(an.is, an);
var ln = function() {
	let e;
	do
		e = f();
	while (e);
};
function hn(t, e, n, r, s) {
	let i;
	s && (i = "object" == typeof n && null !== n, i && (r = t.__dataTemp[e]));
	let o = r !== n && (r == r || n == n);
	return i && o && (t.__dataTemp[e] = n), o;
}
var cn = d$2(((t) => class extends t {
	_shouldPropertyChange(t, e, n) {
		return hn(this, t, e, n, !0);
	}
}));
var dn = d$2(((t) => class extends t {
	static get properties() {
		return { mutableData: Boolean };
	}
	_shouldPropertyChange(t, e, n) {
		return hn(this, t, e, n, this.mutableData);
	}
}));
cn._mutablePropertyChange = hn;
var _n = null;
function un() {
	return _n;
}
un.prototype = Object.create(HTMLTemplateElement.prototype, { constructor: {
	value: un,
	writable: !0
} });
var pn = $e(un);
var fn = cn(pn);
var mn = $e(class {});
var yn = class extends mn {
	constructor(t) {
		super(), this._configureProperties(t), this.root = this._stampTemplate(this.__dataHost);
		let e = [];
		this.children = e;
		for (let t = this.root.firstChild; t; t = t.nextSibling) e.push(t), t.__templatizeInstance = this;
		this.__templatizeOwner && this.__templatizeOwner.__hideTemplateChildren__ && this._showHideChildren(!0);
		let n = this.__templatizeOptions;
		(t && n.instanceProps || !n.instanceProps) && this._enableProperties();
	}
	_configureProperties(t) {
		if (this.__templatizeOptions.forwardHostProp) for (let t in this.__hostProps) this._setPendingProperty(t, this.__dataHost["_host_" + t]);
		for (let e in t) this._setPendingProperty(e, t[e]);
	}
	forwardHostProp(t, e) {
		this._setPendingPropertyOrPath(t, e, !1, !0) && this.__dataHost._enqueueClient(this);
	}
	_addEventListenerToNode(t, e, n) {
		if (this._methodHost && this.__templatizeOptions.parentModel) this._methodHost._addEventListenerToNode(t, e, ((t) => {
			t.model = this, n(t);
		}));
		else {
			let r = this.__dataHost.__dataHost;
			r && r._addEventListenerToNode(t, e, n);
		}
	}
	_showHideChildren(t) {
		(function(t, e) {
			for (let n = 0; n < e.length; n++) {
				let r = e[n];
				if (Boolean(t) != Boolean(r.__hideTemplateChildren__)) if (r.nodeType === Node.TEXT_NODE) t ? (r.__polymerTextContent__ = r.textContent, r.textContent = "") : r.textContent = r.__polymerTextContent__;
				else if ("slot" === r.localName) if (t) r.__polymerReplaced__ = document.createComment("hidden-slot"), I$1(I$1(r).parentNode).replaceChild(r.__polymerReplaced__, r);
				else {
					const t = r.__polymerReplaced__;
					t && I$1(I$1(t).parentNode).replaceChild(r, t);
				}
				else r.style && (t ? (r.__polymerDisplay__ = r.style.display, r.style.display = "none") : r.style.display = r.__polymerDisplay__);
				r.__hideTemplateChildren__ = t, r._showHideChildren && r._showHideChildren(t);
			}
		})(t, this.children);
	}
	_setUnmanagedPropertyToNode(t, e, n) {
		t.__hideTemplateChildren__ && t.nodeType == Node.TEXT_NODE && "textContent" == e ? t.__polymerTextContent__ = n : super._setUnmanagedPropertyToNode(t, e, n);
	}
	get parentModel() {
		let t = this.__parentModel;
		if (!t) {
			let e;
			t = this;
			do
				t = t.__dataHost.__dataHost;
			while ((e = t.__templatizeOptions) && !e.parentModel);
			this.__parentModel = t;
		}
		return t;
	}
	dispatchEvent(t) {
		return !0;
	}
};
yn.prototype.__dataHost, yn.prototype.__templatizeOptions, yn.prototype._methodHost, yn.prototype.__templatizeOwner, yn.prototype.__hostProps;
var gn = cn(yn);
function bn(t) {
	let e = t.__dataHost;
	return e && e._methodHost || e;
}
function Pn(t, e, n) {
	let r = n.mutableData ? gn : yn;
	En.mixin && (r = En.mixin(r));
	let s = class extends r {};
	return s.prototype.__templatizeOptions = n, s.prototype._bindTemplate(t), function(t, e, n, r) {
		let s = n.hostProps || {};
		for (let e in r.instanceProps) {
			delete s[e];
			let n = r.notifyInstanceProp;
			n && t.prototype._addPropertyEffect(e, t.prototype.PROPERTY_EFFECT_TYPES.NOTIFY, { fn: wn(e, n) });
		}
		if (r.forwardHostProp && e.__dataHost) for (let e in s) n.hasHostProps || (n.hasHostProps = !0), t.prototype._addPropertyEffect(e, t.prototype.PROPERTY_EFFECT_TYPES.NOTIFY, { fn: function(t, e, n) {
			t.__dataHost._setPendingPropertyOrPath("_host_" + e, n[e], !0, !0);
		} });
	}(s, t, e, n), s;
}
function vn(t, e, n, r) {
	let s = n.forwardHostProp;
	if (s && e.hasHostProps) {
		const r = "template" == t.localName;
		let a = e.templatizeTemplateClass;
		if (!a) {
			if (r) {
				let t = n.mutableData ? fn : pn;
				class r extends t {}
				a = e.templatizeTemplateClass = r;
			} else {
				const n = t.constructor;
				class r extends n {}
				a = e.templatizeTemplateClass = r;
			}
			let i = e.hostProps;
			for (let t in i) a.prototype._addPropertyEffect("_host_" + t, a.prototype.PROPERTY_EFFECT_TYPES.PROPAGATE, { fn: Cn(t, s) }), a.prototype._createNotifyingProperty("_host_" + t);
		}
		if (t.__dataProto && Object.assign(t.__data, t.__dataProto), r) o = a, _n = i = t, Object.setPrototypeOf(i, o.prototype), new o(), _n = null, t.__dataTemp = {}, t.__dataPending = null, t.__dataOld = null, t._enableProperties();
		else {
			Object.setPrototypeOf(t, a.prototype);
			const n = e.hostProps;
			for (let e in n) if (e = "_host_" + e, e in t) {
				const n = t[e];
				delete t[e], t.__data[e] = n;
			}
		}
	}
	var i, o;
}
function Cn(t, e) {
	return function(t, n, r) {
		e.call(t.__templatizeOwner, n.substring(6), r[n]);
	};
}
function wn(t, e) {
	return function(t, n, r) {
		e.call(t.__templatizeOwner, t, n, r[n]);
	};
}
function En(t, e, n) {
	if (A$1 && !bn(t)) throw new Error("strictTemplatePolicy: template owner not trusted");
	if (n = n || {}, t.__templatizeOwner) throw new Error("A <template> can only be templatized once");
	t.__templatizeOwner = e;
	let r = (e ? e.constructor : yn)._parseTemplate(t), s = r.templatizeInstanceClass;
	s || (s = Pn(t, r, n), r.templatizeInstanceClass = s);
	const i = bn(t);
	vn(t, r, n);
	let o = class extends s {};
	return o.prototype._methodHost = i, o.prototype.__dataHost = t, o.prototype.__templatizeOwner = e, o.prototype.__hostProps = r.hostProps, o;
}
function Tn(t, e) {
	let n;
	for (; e;) if (n = e.__dataHost ? e : e.__templatizeInstance) {
		if (n.__dataHost == t) return n;
		e = n.__dataHost;
	} else e = I$1(e).parentNode;
	return null;
}
var On = class extends tn {
	static get is() {
		return "dom-if";
	}
	static get template() {
		return null;
	}
	static get properties() {
		return {
			if: {
				type: Boolean,
				observer: "__debounceRender"
			},
			updateWhenFalse: { type: Boolean },
			restamp: {
				type: Boolean,
				observer: "__debounceRender"
			},
			notifyDomChange: { type: Boolean }
		};
	}
	constructor() {
		super(), this.__renderDebouncer = null, this._lastIf = !1, this.__hideTemplateChildren__ = !1, this.__template, this._templateInfo;
	}
	__debounceRender() {
		this.__renderDebouncer = _$1.debounce(this.__renderDebouncer, h, (() => this.__render())), p$2(this.__renderDebouncer);
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		const t = I$1(this).parentNode;
		t && (t.nodeType != Node.DOCUMENT_FRAGMENT_NODE || I$1(t).host) || this.__teardownInstance();
	}
	connectedCallback() {
		super.connectedCallback(), this.style.display = "none", this.if && this.__debounceRender();
	}
	__ensureTemplate() {
		if (!this.__template) {
			const t = this;
			let e = t._templateInfo ? t : I$1(t).querySelector("template");
			if (!e) {
				let t = new MutationObserver((() => {
					if (!I$1(this).querySelector("template")) throw new Error("dom-if requires a <template> child");
					t.disconnect(), this.__render();
				}));
				return t.observe(this, { childList: !0 }), !1;
			}
			this.__template = e;
		}
		return !0;
	}
	__ensureInstance() {
		let t = I$1(this).parentNode;
		if (this.__hasInstance()) {
			let e = this.__getInstanceNodes();
			if (e && e.length) {
				if (I$1(this).previousSibling !== e[e.length - 1]) for (let n, r = 0; r < e.length && (n = e[r]); r++) I$1(t).insertBefore(n, this);
			}
		} else {
			if (!t) return !1;
			if (!this.__ensureTemplate()) return !1;
			this.__createAndInsertInstance(t);
		}
		return !0;
	}
	render() {
		ln();
	}
	__render() {
		if (this.if) {
			if (!this.__ensureInstance()) return;
		} else this.restamp && this.__teardownInstance();
		this._showHideChildren(), this.if != this._lastIf && (this.dispatchEvent(new CustomEvent("dom-change", {
			bubbles: !0,
			composed: !0
		})), this._lastIf = this.if);
	}
	__hasInstance() {}
	__getInstanceNodes() {}
	__createAndInsertInstance(t) {}
	__teardownInstance() {}
	_showHideChildren() {}
};
var An = class extends On {
	constructor() {
		super(), this.__ctor = null, this.__instance = null, this.__invalidProps = null;
	}
	__hasInstance() {
		return Boolean(this.__instance);
	}
	__getInstanceNodes() {
		return this.__instance.children;
	}
	__createAndInsertInstance(t) {
		this.__ctor || (this.__ctor = En(this.__template, this, {
			mutableData: !0,
			forwardHostProp: function(t, e) {
				this.__instance && (this.if || this.updateWhenFalse ? this.__instance.forwardHostProp(t, e) : (this.__invalidProps = this.__invalidProps || Object.create(null), this.__invalidProps[Lt(t)] = !0));
			}
		})), this.__instance = new this.__ctor(), I$1(t).insertBefore(this.__instance.root, this);
	}
	__teardownInstance() {
		if (this.__instance) {
			let t = this.__instance.children;
			if (t && t.length) {
				let e = I$1(t[0]).parentNode;
				if (e) {
					e = I$1(e);
					for (let n, r = 0; r < t.length && (n = t[r]); r++) e.removeChild(n);
				}
			}
			this.__invalidProps = null, this.__instance = null;
		}
	}
	__syncHostProperties() {
		let t = this.__invalidProps;
		if (t) {
			this.__invalidProps = null;
			for (let e in t) this.__instance._setPendingProperty(e, this.__dataHost[e]);
			this.__instance._flushProperties();
		}
	}
	_showHideChildren() {
		const t = this.__hideTemplateChildren__ || !this.if;
		this.__instance && Boolean(this.__instance.__hidden) !== t && (this.__instance.__hidden = t, this.__instance._showHideChildren(t)), t || this.__syncHostProperties();
	}
};
customElements.define(An.is, An);
var Nn = dn(tn);
var xn = class extends Nn {
	static get is() {
		return "dom-repeat";
	}
	static get template() {
		return null;
	}
	static get properties() {
		return {
			items: { type: Array },
			as: {
				type: String,
				value: "item"
			},
			indexAs: {
				type: String,
				value: "index"
			},
			itemsIndexAs: {
				type: String,
				value: "itemsIndex"
			},
			sort: {
				type: Function,
				observer: "__sortChanged"
			},
			filter: {
				type: Function,
				observer: "__filterChanged"
			},
			observe: {
				type: String,
				observer: "__observeChanged"
			},
			delay: Number,
			renderedItemCount: {
				type: Number,
				notify: !0,
				readOnly: !0
			},
			initialCount: { type: Number },
			targetFramerate: {
				type: Number,
				value: 20
			},
			_targetFrameTime: {
				type: Number,
				computed: "__computeFrameTime(targetFramerate)"
			},
			notifyDomChange: { type: Boolean },
			reuseChunkedInstances: { type: Boolean }
		};
	}
	static get observers() {
		return ["__itemsChanged(items.*)"];
	}
	constructor() {
		super(), this.__instances = [], this.__renderDebouncer = null, this.__itemsIdxToInstIdx = {}, this.__chunkCount = null, this.__renderStartTime = null, this.__itemsArrayChanged = !1, this.__shouldMeasureChunk = !1, this.__shouldContinueChunking = !1, this.__chunkingId = 0, this.__sortFn = null, this.__filterFn = null, this.__observePaths = null, this.__ctor = null, this.__isDetached = !0, this.template = null, this._templateInfo;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.__isDetached = !0;
		for (let t = 0; t < this.__instances.length; t++) this.__detachInstance(t);
		this.__chunkingId && cancelAnimationFrame(this.__chunkingId);
	}
	connectedCallback() {
		if (super.connectedCallback(), this.style.display = "none", this.__isDetached) {
			this.__isDetached = !1;
			let t = I$1(I$1(this).parentNode);
			for (let e = 0; e < this.__instances.length; e++) this.__attachInstance(e, t);
			this.__chunkingId && this.__render();
		}
	}
	__ensureTemplatized() {
		if (!this.__ctor) {
			const t = this;
			let e = this.template = t._templateInfo ? t : this.querySelector("template");
			if (!e) {
				let t = new MutationObserver((() => {
					if (!this.querySelector("template")) throw new Error("dom-repeat requires a <template> child");
					t.disconnect(), this.__render();
				}));
				return t.observe(this, { childList: !0 }), !1;
			}
			let n = {};
			n[this.as] = !0, n[this.indexAs] = !0, n[this.itemsIndexAs] = !0, this.__ctor = En(e, this, {
				mutableData: this.mutableData,
				parentModel: !0,
				instanceProps: n,
				forwardHostProp: function(t, e) {
					let n = this.__instances;
					for (let r, s = 0; s < n.length && (r = n[s]); s++) r.forwardHostProp(t, e);
				},
				notifyInstanceProp: function(t, e, n) {
					if (Ft(this.as, e)) {
						let r = t[this.itemsIndexAs];
						e == this.as && (this.items[r] = n);
						let s = Rt(this.as, `${JSCompiler_renameProperty("items", this)}.${r}`, e);
						this.notifyPath(s, n);
					}
				}
			});
		}
		return !0;
	}
	__getMethodHost() {
		return this.__dataHost._methodHost || this.__dataHost;
	}
	__functionFromPropertyValue(t) {
		if ("string" == typeof t) {
			let e = t, n = this.__getMethodHost();
			return function() {
				return n[e].apply(n, arguments);
			};
		}
		return t;
	}
	__sortChanged(t) {
		this.__sortFn = this.__functionFromPropertyValue(t), this.items && this.__debounceRender(this.__render);
	}
	__filterChanged(t) {
		this.__filterFn = this.__functionFromPropertyValue(t), this.items && this.__debounceRender(this.__render);
	}
	__computeFrameTime(t) {
		return Math.ceil(1e3 / t);
	}
	__observeChanged() {
		this.__observePaths = this.observe && this.observe.replace(".*", ".").split(" ");
	}
	__handleObservedPaths(t) {
		if (this.__sortFn || this.__filterFn) if (t) {
			if (this.__observePaths) {
				let e = this.__observePaths;
				for (let n = 0; n < e.length; n++) 0 === t.indexOf(e[n]) && this.__debounceRender(this.__render, this.delay);
			}
		} else this.__debounceRender(this.__render, this.delay);
	}
	__itemsChanged(t) {
		this.items && !Array.isArray(this.items) && console.warn("dom-repeat expected array for `items`, found", this.items), this.__handleItemPath(t.path, t.value) || ("items" === t.path && (this.__itemsArrayChanged = !0), this.__debounceRender(this.__render));
	}
	__debounceRender(t, e = 0) {
		this.__renderDebouncer = _$1.debounce(this.__renderDebouncer, e > 0 ? o.after(e) : h, t.bind(this)), p$2(this.__renderDebouncer);
	}
	render() {
		this.__debounceRender(this.__render), ln();
	}
	__render() {
		if (!this.__ensureTemplatized()) return;
		let t = this.items || [];
		const e = this.__sortAndFilterItems(t), n = this.__calculateLimit(e.length);
		this.__updateInstances(t, n, e), this.initialCount && (this.__shouldMeasureChunk || this.__shouldContinueChunking) && (cancelAnimationFrame(this.__chunkingId), this.__chunkingId = requestAnimationFrame((() => {
			this.__chunkingId = null, this.__continueChunking();
		}))), this._setRenderedItemCount(this.__instances.length), this.dispatchEvent(new CustomEvent("dom-change", {
			bubbles: !0,
			composed: !0
		}));
	}
	__sortAndFilterItems(t) {
		let e = new Array(t.length);
		for (let n = 0; n < t.length; n++) e[n] = n;
		return this.__filterFn && (e = e.filter(((e, n, r) => this.__filterFn(t[e], n, r)))), this.__sortFn && e.sort(((e, n) => this.__sortFn(t[e], t[n]))), e;
	}
	__calculateLimit(t) {
		let e = t;
		const n = this.__instances.length;
		if (this.initialCount) {
			let r;
			!this.__chunkCount || this.__itemsArrayChanged && !this.reuseChunkedInstances ? (e = Math.min(t, this.initialCount), r = Math.max(e - n, 0), this.__chunkCount = r || 1) : (r = Math.min(Math.max(t - n, 0), this.__chunkCount), e = Math.min(n + r, t)), this.__shouldMeasureChunk = r === this.__chunkCount, this.__shouldContinueChunking = e < t, this.__renderStartTime = performance.now();
		}
		return this.__itemsArrayChanged = !1, e;
	}
	__continueChunking() {
		if (this.__shouldMeasureChunk) {
			const t = performance.now() - this.__renderStartTime, e = this._targetFrameTime / t;
			this.__chunkCount = Math.round(this.__chunkCount * e) || 1;
		}
		this.__shouldContinueChunking && this.__debounceRender(this.__render);
	}
	__updateInstances(t, e, n) {
		const r = this.__itemsIdxToInstIdx = {};
		let s;
		for (s = 0; s < e; s++) {
			let e = this.__instances[s], i = n[s], o = t[i];
			r[i] = s, e ? (e._setPendingProperty(this.as, o), e._setPendingProperty(this.indexAs, s), e._setPendingProperty(this.itemsIndexAs, i), e._flushProperties()) : this.__insertInstance(o, s, i);
		}
		for (let t = this.__instances.length - 1; t >= s; t--) this.__detachAndRemoveInstance(t);
	}
	__detachInstance(t) {
		let e = this.__instances[t];
		const n = I$1(e.root);
		for (let t = 0; t < e.children.length; t++) {
			let r = e.children[t];
			n.appendChild(r);
		}
		return e;
	}
	__attachInstance(t, e) {
		let n = this.__instances[t];
		e.insertBefore(n.root, this);
	}
	__detachAndRemoveInstance(t) {
		this.__detachInstance(t), this.__instances.splice(t, 1);
	}
	__stampInstance(t, e, n) {
		let r = {};
		return r[this.as] = t, r[this.indexAs] = e, r[this.itemsIndexAs] = n, new this.__ctor(r);
	}
	__insertInstance(t, e, n) {
		const r = this.__stampInstance(t, e, n);
		let s = this.__instances[e + 1], i = s ? s.children[0] : this;
		return I$1(I$1(this).parentNode).insertBefore(r.root, i), this.__instances[e] = r, r;
	}
	_showHideChildren(t) {
		for (let e = 0; e < this.__instances.length; e++) this.__instances[e]._showHideChildren(t);
	}
	__handleItemPath(t, e) {
		let n = t.slice(6), r = n.indexOf("."), s = r < 0 ? n : n.substring(0, r);
		if (s == parseInt(s, 10)) {
			let t = r < 0 ? "" : n.substring(r + 1);
			this.__handleObservedPaths(t);
			let i = this.__itemsIdxToInstIdx[s], o = this.__instances[i];
			if (o) {
				let n = this.as + (t ? "." + t : "");
				o._setPendingPropertyOrPath(n, e, !1, !0), o._flushProperties();
			}
			return !0;
		}
	}
	itemForElement(t) {
		let e = this.modelForElement(t);
		return e && e[this.as];
	}
	indexForElement(t) {
		let e = this.modelForElement(t);
		return e && e[this.indexAs];
	}
	modelForElement(t) {
		return Tn(this.template, t);
	}
};
customElements.define(xn.is, xn);
var Sn = d$2(((t) => class extends t {
	_addEventListenerToNode(t, e, n) {
		it(t, e, n) || super._addEventListenerToNode(t, e, n);
	}
	_removeEventListenerFromNode(t, e, n) {
		ot(t, e, n) || super._removeEventListenerFromNode(t, e, n);
	}
}));
var In = !1;
var kn = [];
var Ln = [];
function Mn() {
	In = !0, requestAnimationFrame((function() {
		In = !1, function(t) {
			for (; t.length;) Dn(t.shift());
		}(kn), setTimeout((function() {
			(function(t) {
				for (let e = 0, n = t.length; e < n; e++) Dn(t.shift());
			})(Ln);
		}));
	}));
}
function Dn(t) {
	const e = t[0], n = t[1], r = t[2];
	try {
		n.apply(e, r);
	} catch (t) {
		setTimeout((() => {
			throw t;
		}));
	}
}
function Rn(t, e, n) {
	In || Mn(), kn.push([
		t,
		e,
		n
	]);
}
function Fn(t, e, n) {
	In || Mn(), Ln.push([
		t,
		e,
		n
	]);
}
function Hn() {
	document.body.removeAttribute("unresolved");
}
function zn(t) {
	return "slot" === t.localName;
}
"interactive" === document.readyState || "complete" === document.readyState ? Hn() : window.addEventListener("DOMContentLoaded", Hn);
var jn = class {
	static getFlattenedNodes(t) {
		const e = I$1(t);
		return zn(t) ? e.assignedNodes({ flatten: !0 }) : Array.from(e.childNodes).map(((t) => zn(t) ? I$1(t).assignedNodes({ flatten: !0 }) : [t])).reduce(((t, e) => t.concat(e)), []);
	}
	constructor(t, e) {
		this._shadyChildrenObserver = null, this._nativeChildrenObserver = null, this._connected = !1, this._target = t, this.callback = e, this._effectiveNodes = [], this._observer = null, this._scheduled = !1, this._boundSchedule = () => {
			this._schedule();
		}, this.connect(), this._schedule();
	}
	connect() {
		zn(this._target) ? this._listenSlots([this._target]) : I$1(this._target).children && (this._listenSlots(I$1(this._target).children), this._nativeChildrenObserver = new MutationObserver(((t) => {
			this._processMutations(t);
		})), this._nativeChildrenObserver.observe(this._target, { childList: !0 })), this._connected = !0;
	}
	disconnect() {
		zn(this._target) ? this._unlistenSlots([this._target]) : I$1(this._target).children && (this._unlistenSlots(I$1(this._target).children), this._nativeChildrenObserver && (this._nativeChildrenObserver.disconnect(), this._nativeChildrenObserver = null)), this._connected = !1;
	}
	_schedule() {
		this._scheduled || (this._scheduled = !0, h.run((() => this.flush())));
	}
	_processMutations(t) {
		this._processSlotMutations(t), this.flush();
	}
	_processSlotMutations(t) {
		if (t) for (let e = 0; e < t.length; e++) {
			let n = t[e];
			n.addedNodes && this._listenSlots(n.addedNodes), n.removedNodes && this._unlistenSlots(n.removedNodes);
		}
	}
	flush() {
		if (!this._connected) return !1;
		this._nativeChildrenObserver ? this._processSlotMutations(this._nativeChildrenObserver.takeRecords()) : this._shadyChildrenObserver && this._processSlotMutations(this._shadyChildrenObserver.takeRecords()), this._scheduled = !1;
		let t = {
			target: this._target,
			addedNodes: [],
			removedNodes: []
		}, e = this.constructor.getFlattenedNodes(this._target), n = rn(e, this._effectiveNodes);
		for (let e, r = 0; r < n.length && (e = n[r]); r++) for (let n, r = 0; r < e.removed.length && (n = e.removed[r]); r++) t.removedNodes.push(n);
		for (let r, s = 0; s < n.length && (r = n[s]); s++) for (let n = r.index; n < r.index + r.addedCount; n++) t.addedNodes.push(e[n]);
		this._effectiveNodes = e;
		let r = !1;
		return (t.addedNodes.length || t.removedNodes.length) && (r = !0, this.callback.call(this._target, t)), r;
	}
	_listenSlots(t) {
		for (let e = 0; e < t.length; e++) {
			let n = t[e];
			zn(n) && n.addEventListener("slotchange", this._boundSchedule);
		}
	}
	_unlistenSlots(t) {
		for (let e = 0; e < t.length; e++) {
			let n = t[e];
			zn(n) && n.removeEventListener("slotchange", this._boundSchedule);
		}
	}
};
var Bn = Element.prototype;
var Jn = Bn.matches || Bn.matchesSelector || Bn.mozMatchesSelector || Bn.msMatchesSelector || Bn.oMatchesSelector || Bn.webkitMatchesSelector;
var qn = function(t, e) {
	return Jn.call(t, e);
};
var Yn = class {
	constructor(t) {
		this.node = t;
	}
	observeNodes(t) {
		return new jn(this.node, t);
	}
	unobserveNodes(t) {
		t.disconnect();
	}
	notifyObserver() {}
	deepContains(t) {
		if (I$1(this.node).contains(t)) return !0;
		let e = t, n = t.ownerDocument;
		for (; e && e !== n && e !== this.node;) e = I$1(e).parentNode || I$1(e).host;
		return e === this.node;
	}
	getOwnerRoot() {
		return I$1(this.node).getRootNode();
	}
	getDistributedNodes() {
		return "slot" === this.node.localName ? I$1(this.node).assignedNodes({ flatten: !0 }) : [];
	}
	getDestinationInsertionPoints() {
		let t = [], e = I$1(this.node).assignedSlot;
		for (; e;) t.push(e), e = I$1(e).assignedSlot;
		return t;
	}
	importNode(t, e) {
		return I$1(this.node instanceof Document ? this.node : this.node.ownerDocument).importNode(t, e);
	}
	getEffectiveChildNodes() {
		return jn.getFlattenedNodes(this.node);
	}
	queryDistributedElements(t) {
		let e = this.getEffectiveChildNodes(), n = [];
		for (let r, s = 0, i = e.length; s < i && (r = e[s]); s++) r.nodeType === Node.ELEMENT_NODE && qn(r, t) && n.push(r);
		return n;
	}
	get activeElement() {
		let t = this.node;
		return void 0 !== t._activeElement ? t._activeElement : t.activeElement;
	}
};
function $n(t, e) {
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		Object.defineProperty(t, r, {
			get: function() {
				return this.node[r];
			},
			configurable: !0
		});
	}
}
var Un = class {
	constructor(t) {
		this.event = t;
	}
	get rootTarget() {
		return this.path[0];
	}
	get localTarget() {
		return this.event.target;
	}
	get path() {
		return this.event.composedPath();
	}
};
Yn.prototype.cloneNode, Yn.prototype.appendChild, Yn.prototype.insertBefore, Yn.prototype.removeChild, Yn.prototype.replaceChild, Yn.prototype.setAttribute, Yn.prototype.removeAttribute, Yn.prototype.querySelector, Yn.prototype.querySelectorAll, Yn.prototype.parentNode, Yn.prototype.firstChild, Yn.prototype.lastChild, Yn.prototype.nextSibling, Yn.prototype.previousSibling, Yn.prototype.firstElementChild, Yn.prototype.lastElementChild, Yn.prototype.nextElementSibling, Yn.prototype.previousElementSibling, Yn.prototype.childNodes, Yn.prototype.children, Yn.prototype.classList, Yn.prototype.textContent, Yn.prototype.innerHTML;
var Vn = Yn;
(function(t, e) {
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		t[r] = function() {
			return this.node[r].apply(this.node, arguments);
		};
	}
})(Yn.prototype, [
	"cloneNode",
	"appendChild",
	"insertBefore",
	"removeChild",
	"replaceChild",
	"setAttribute",
	"removeAttribute",
	"querySelector",
	"querySelectorAll",
	"attachShadow"
]), $n(Yn.prototype, [
	"parentNode",
	"firstChild",
	"lastChild",
	"nextSibling",
	"previousSibling",
	"firstElementChild",
	"lastElementChild",
	"nextElementSibling",
	"previousElementSibling",
	"childNodes",
	"children",
	"classList",
	"shadowRoot"
]), function(t, e) {
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		Object.defineProperty(t, r, {
			get: function() {
				return this.node[r];
			},
			set: function(t) {
				this.node[r] = t;
			},
			configurable: !0
		});
	}
}(Yn.prototype, [
	"textContent",
	"innerHTML",
	"className"
]);
var Xn = function(t) {
	if ((t = t || document) instanceof Vn) return t;
	if (t instanceof Un) return t;
	let e = t.__domApi;
	return e || (e = t instanceof Event ? new Un(t) : new Vn(t), t.__domApi = e), e;
};
var Gn = "disable-upgrade";
var Wn = (t) => {
	for (; t;) {
		const e = Object.getOwnPropertyDescriptor(t, "observedAttributes");
		if (e) return e.get;
		t = Object.getPrototypeOf(t.prototype).constructor;
	}
	return () => [];
};
d$2(((t) => {
	const e = Xe(t);
	let n = Wn(e);
	return class extends e {
		constructor() {
			super(), this.__isUpgradeDisabled;
		}
		static get observedAttributes() {
			return n.call(this).concat(Gn);
		}
		_initializeProperties() {
			this.hasAttribute(Gn) ? this.__isUpgradeDisabled = !0 : super._initializeProperties();
		}
		_enableProperties() {
			this.__isUpgradeDisabled || super._enableProperties();
		}
		_canApplyPropertyDefault(t) {
			return super._canApplyPropertyDefault(t) && !(this.__isUpgradeDisabled && this._isPropertyPending(t));
		}
		attributeChangedCallback(t, e, n, r) {
			t == Gn ? this.__isUpgradeDisabled && null == n && (super._initializeProperties(), this.__isUpgradeDisabled = !1, I$1(this).isConnected && super.connectedCallback()) : super.attributeChangedCallback(t, e, n, r);
		}
		connectedCallback() {
			this.__isUpgradeDisabled || super.connectedCallback();
		}
		disconnectedCallback() {
			this.__isUpgradeDisabled || super.disconnectedCallback();
		}
	};
}));
var Zn = "disable-upgrade";
var Kn = d$2(((t) => {
	const e = Sn(Xe(t)), n = Wn(e), r = {
		x: "pan-x",
		y: "pan-y",
		none: "none",
		all: "auto"
	};
	class s extends e {
		constructor() {
			super(), this.isAttached, this.__boundListeners, this._debouncers, this.__isUpgradeDisabled, this.__needsAttributesAtConnected, this._legacyForceObservedAttributes;
		}
		static get importMeta() {
			return this.prototype.importMeta;
		}
		created() {}
		__attributeReaction(t, e, n) {
			(this.__dataAttributes && this.__dataAttributes[t] || t === Zn) && this.attributeChangedCallback(t, e, n, null);
		}
		setAttribute(t, e) {
			super.setAttribute(t, e);
		}
		removeAttribute(t) {
			super.removeAttribute(t);
		}
		static get observedAttributes() {
			return n.call(this).concat(Zn);
		}
		_enableProperties() {
			this.__isUpgradeDisabled || super._enableProperties();
		}
		_canApplyPropertyDefault(t) {
			return super._canApplyPropertyDefault(t) && !(this.__isUpgradeDisabled && this._isPropertyPending(t));
		}
		connectedCallback() {
			this.__needsAttributesAtConnected && this._takeAttributes(), this.__isUpgradeDisabled || (super.connectedCallback(), this.isAttached = !0, this.attached());
		}
		attached() {}
		disconnectedCallback() {
			this.__isUpgradeDisabled || (super.disconnectedCallback(), this.isAttached = !1, this.detached());
		}
		detached() {}
		attributeChangedCallback(t, e, n, r) {
			e !== n && (t == Zn ? this.__isUpgradeDisabled && null == n && (this._initializeProperties(), this.__isUpgradeDisabled = !1, I$1(this).isConnected && this.connectedCallback()) : (super.attributeChangedCallback(t, e, n, r), this.attributeChanged(t, e, n)));
		}
		attributeChanged(t, e, n) {}
		_initializeProperties() {
			{
				let t = Object.getPrototypeOf(this);
				t.hasOwnProperty(JSCompiler_renameProperty("__hasRegisterFinished", t)) || (this._registered(), t.__hasRegisterFinished = !0), super._initializeProperties(), this.root = this, this.created(), this._applyListeners();
			}
		}
		_takeAttributes() {
			const t = this.attributes;
			for (let e = 0, n = t.length; e < n; e++) {
				const n = t[e];
				this.__attributeReaction(n.name, null, n.value);
			}
		}
		_registered() {}
		ready() {
			this._ensureAttributes(), super.ready();
		}
		_ensureAttributes() {}
		_applyListeners() {}
		serialize(t) {
			return this._serializeValue(t);
		}
		deserialize(t, e) {
			return this._deserializeValue(t, e);
		}
		reflectPropertyToAttribute(t, e, n) {
			this._propertyToAttribute(t, e, n);
		}
		serializeValueToAttribute(t, e, n) {
			this._valueToNodeAttribute(n || this, t, e);
		}
		extend(t, e) {
			if (!t || !e) return t || e;
			let n = Object.getOwnPropertyNames(e);
			for (let r, s = 0; s < n.length && (r = n[s]); s++) {
				let n = Object.getOwnPropertyDescriptor(e, r);
				n && Object.defineProperty(t, r, n);
			}
			return t;
		}
		mixin(t, e) {
			for (let n in e) t[n] = e[n];
			return t;
		}
		chainObject(t, e) {
			return t && e && t !== e && (t.__proto__ = e), t;
		}
		instanceTemplate(t) {
			let e = this.constructor._contentForTemplate(t);
			return document.importNode(e, !0);
		}
		fire(t, e, n) {
			n = n || {}, e = null == e ? {} : e;
			let r = new Event(t, {
				bubbles: void 0 === n.bubbles || n.bubbles,
				cancelable: Boolean(n.cancelable),
				composed: void 0 === n.composed || n.composed
			});
			r.detail = e;
			return I$1(n.node || this).dispatchEvent(r), r;
		}
		listen(t, e, n) {
			t = t || this;
			let r = this.__boundListeners || (this.__boundListeners = /* @__PURE__ */ new WeakMap()), s = r.get(t);
			s || (s = {}, r.set(t, s));
			let i = e + n;
			s[i] || (s[i] = this._addMethodEventListenerToNode(t, e, n, this));
		}
		unlisten(t, e, n) {
			t = t || this;
			let r = this.__boundListeners && this.__boundListeners.get(t), s = e + n, i = r && r[s];
			i && (this._removeEventListenerFromNode(t, e, i), r[s] = null);
		}
		setScrollDirection(t, e) {
			lt(e || this, r[t] || "auto");
		}
		$$(t) {
			return this.root.querySelector(t);
		}
		get domHost() {
			let t = I$1(this).getRootNode();
			return t instanceof DocumentFragment ? t.host : t;
		}
		distributeContent() {
			Xn(this);
		}
		getEffectiveChildNodes() {
			return Xn(this).getEffectiveChildNodes();
		}
		queryDistributedElements(t) {
			return Xn(this).queryDistributedElements(t);
		}
		getEffectiveChildren() {
			return this.getEffectiveChildNodes().filter((function(t) {
				return t.nodeType === Node.ELEMENT_NODE;
			}));
		}
		getEffectiveTextContent() {
			let t = this.getEffectiveChildNodes(), e = [];
			for (let n, r = 0; n = t[r]; r++) n.nodeType !== Node.COMMENT_NODE && e.push(n.textContent);
			return e.join("");
		}
		queryEffectiveChildren(t) {
			let e = this.queryDistributedElements(t);
			return e && e[0];
		}
		queryAllEffectiveChildren(t) {
			return this.queryDistributedElements(t);
		}
		getContentChildNodes(t) {
			let e = this.root.querySelector(t || "slot");
			return e ? Xn(e).getDistributedNodes() : [];
		}
		getContentChildren(t) {
			return this.getContentChildNodes(t).filter((function(t) {
				return t.nodeType === Node.ELEMENT_NODE;
			}));
		}
		isLightDescendant(t) {
			const e = this;
			return e !== t && I$1(e).contains(t) && I$1(e).getRootNode() === I$1(t).getRootNode();
		}
		isLocalDescendant(t) {
			return this.root === I$1(t).getRootNode();
		}
		scopeSubtree(t, e = !1) {
			return null;
		}
		getComputedStyleValue(t) {
			return false.getComputedStyleValue(this, t);
		}
		debounce(t, e, n) {
			return this._debouncers = this._debouncers || {}, this._debouncers[t] = _$1.debounce(this._debouncers[t], n > 0 ? o.after(n) : h, e.bind(this));
		}
		isDebouncerActive(t) {
			this._debouncers = this._debouncers || {};
			let e = this._debouncers[t];
			return !(!e || !e.isActive());
		}
		flushDebouncer(t) {
			this._debouncers = this._debouncers || {};
			let e = this._debouncers[t];
			e && e.flush();
		}
		cancelDebouncer(t) {
			this._debouncers = this._debouncers || {};
			let e = this._debouncers[t];
			e && e.cancel();
		}
		async(t, e) {
			return e > 0 ? o.run(t.bind(this), e) : ~h.run(t.bind(this));
		}
		cancelAsync(t) {
			t < 0 ? h.cancel(~t) : o.cancel(t);
		}
		create(t, e) {
			let n = document.createElement(t);
			if (e) if (n.setProperties) n.setProperties(e);
			else for (let t in e) n[t] = e[t];
			return n;
		}
		elementMatches(t, e) {
			return qn(e || this, t);
		}
		toggleAttribute(t, e) {
			let n = this;
			return 3 === arguments.length && (n = arguments[2]), 1 == arguments.length && (e = !n.hasAttribute(t)), e ? (I$1(n).setAttribute(t, ""), !0) : (I$1(n).removeAttribute(t), !1);
		}
		toggleClass(t, e, n) {
			n = n || this, 1 == arguments.length && (e = !n.classList.contains(t)), e ? n.classList.add(t) : n.classList.remove(t);
		}
		transform(t, e) {
			(e = e || this).style.webkitTransform = t, e.style.transform = t;
		}
		translate3d(t, e, n, r) {
			r = r || this, this.transform("translate3d(" + t + "," + e + "," + n + ")", r);
		}
		arrayDelete(t, e) {
			let n;
			if (Array.isArray(t)) {
				if (n = t.indexOf(e), n >= 0) return t.splice(n, 1);
			} else if (n = jt(this, t).indexOf(e), n >= 0) return this.splice(t, n, 1);
			return null;
		}
		_logger(t, e) {
			switch (Array.isArray(e) && 1 === e.length && Array.isArray(e[0]) && (e = e[0]), t) {
				case "log":
				case "warn":
				case "error": console[t](...e);
			}
		}
		_log(...t) {
			this._logger("log", t);
		}
		_warn(...t) {
			this._logger("warn", t);
		}
		_error(...t) {
			this._logger("error", t);
		}
		_logf(t, ...e) {
			return [
				"[%s::%s]",
				this.is,
				t,
				...e
			];
		}
	}
	return s.prototype.is = "", s;
}));
var Qn = {
	attached: !0,
	detached: !0,
	ready: !0,
	created: !0,
	beforeRegister: !0,
	registered: !0,
	attributeChanged: !0,
	listeners: !0,
	hostAttributes: !0
};
var tr = {
	attached: !0,
	detached: !0,
	ready: !0,
	created: !0,
	beforeRegister: !0,
	registered: !0,
	attributeChanged: !0,
	behaviors: !0,
	_noAccessors: !0
};
var er = Object.assign({
	listeners: !0,
	hostAttributes: !0,
	properties: !0,
	observers: !0
}, tr);
function rr(t, e, n, r) {
	(function(t, e, n) {
		const r = t._noAccessors, s = Object.getOwnPropertyNames(t);
		for (let i = 0; i < s.length; i++) {
			let o = s[i];
			if (!(o in n)) if (r) e[o] = t[o];
			else {
				let n = Object.getOwnPropertyDescriptor(t, o);
				n && (n.configurable = !0, Object.defineProperty(e, o, n));
			}
		}
	})(e, t, r);
	for (let t in Qn) e[t] && (n[t] = n[t] || [], n[t].push(e[t]));
}
function sr(t, e, n) {
	e = e || [];
	for (let r = t.length - 1; r >= 0; r--) {
		let s = t[r];
		s ? Array.isArray(s) ? sr(s, e) : e.indexOf(s) < 0 && (!n || n.indexOf(s) < 0) && e.unshift(s) : console.warn("behavior is null, check for missing or 404 import");
	}
	return e;
}
function ir(t, e) {
	for (const n in e) {
		const r = t[n], s = e[n];
		t[n] = !("value" in s) && r && "value" in r ? Object.assign({ value: r.value }, s) : s;
	}
}
var or = Kn(HTMLElement);
function ar(t, e, n) {
	let r;
	const s = {};
	class i extends e {
		static _finalizeClass() {
			if (this.hasOwnProperty(JSCompiler_renameProperty("generatedFrom", this))) {
				if (r) for (let t, e = 0; e < r.length; e++) t = r[e], t.properties && this.createProperties(t.properties), t.observers && this.createObservers(t.observers, t.properties);
				t.properties && this.createProperties(t.properties), t.observers && this.createObservers(t.observers, t.properties), this._prepareTemplate();
			} else e._finalizeClass.call(this);
		}
		static get properties() {
			const e = {};
			if (r) for (let t = 0; t < r.length; t++) ir(e, r[t].properties);
			return ir(e, t.properties), e;
		}
		static get observers() {
			let e = [];
			if (r) for (let t, n = 0; n < r.length; n++) t = r[n], t.observers && (e = e.concat(t.observers));
			return t.observers && (e = e.concat(t.observers)), e;
		}
		created() {
			super.created();
			const t = s.created;
			if (t) for (let e = 0; e < t.length; e++) t[e].call(this);
		}
		_registered() {
			const t = i.prototype;
			if (!t.hasOwnProperty(JSCompiler_renameProperty("__hasRegisterFinished", t))) {
				t.__hasRegisterFinished = !0, super._registered();
				const e = Object.getPrototypeOf(this);
				let n = s.beforeRegister;
				if (n) for (let t = 0; t < n.length; t++) n[t].call(e);
				if (n = s.registered, n) for (let t = 0; t < n.length; t++) n[t].call(e);
			}
		}
		_applyListeners() {
			super._applyListeners();
			const t = s.listeners;
			if (t) for (let e = 0; e < t.length; e++) {
				const n = t[e];
				if (n) for (let t in n) this._addMethodEventListenerToNode(this, t, n[t]);
			}
		}
		_ensureAttributes() {
			const t = s.hostAttributes;
			if (t) for (let e = t.length - 1; e >= 0; e--) {
				const n = t[e];
				for (let t in n) this._ensureAttribute(t, n[t]);
			}
			super._ensureAttributes();
		}
		ready() {
			super.ready();
			let t = s.ready;
			if (t) for (let e = 0; e < t.length; e++) t[e].call(this);
		}
		attached() {
			super.attached();
			let t = s.attached;
			if (t) for (let e = 0; e < t.length; e++) t[e].call(this);
		}
		detached() {
			super.detached();
			let t = s.detached;
			if (t) for (let e = 0; e < t.length; e++) t[e].call(this);
		}
		attributeChanged(t, e, n) {
			super.attributeChanged();
			let r = s.attributeChanged;
			if (r) for (let s = 0; s < r.length; s++) r[s].call(this, t, e, n);
		}
	}
	if (n) {
		Array.isArray(n) || (n = [n]);
		let t = e.prototype.behaviors;
		r = sr(n, null, t), i.prototype.behaviors = t ? t.concat(n) : r;
	}
	const o = (e) => {
		r && function(t, e, n) {
			for (let r = 0; r < e.length; r++) rr(t, e[r], n, er);
		}(e, r, s), rr(e, t, s, tr);
	};
	return o(i.prototype), i.generatedFrom = t, i;
}
cn._mutablePropertyChange;
var cr = function(t) {
	let e;
	return e = "function" == typeof t ? t : cr.Class(t), t._legacyForceObservedAttributes && (e.prototype._legacyForceObservedAttributes = t._legacyForceObservedAttributes), customElements.define(e.is, e), e;
};
cr.Class = function(t, e) {
	t || console.warn("Polymer.Class requires `info` argument");
	let n = e ? e(or) : or;
	return n = ar(t, n, t.behaviors), n.is = n.prototype.is = t.is, n;
};
var _r = Sn(dn($e(HTMLElement)));
customElements.define("dom-bind", class extends _r {
	static get observedAttributes() {
		return ["mutable-data"];
	}
	constructor() {
		if (super(), A$1) throw new Error("strictTemplatePolicy: dom-bind not allowed");
		this.root = null, this.$ = null, this.__children = null;
	}
	attributeChangedCallback(t, e, n, r) {
		this.mutableData = !0;
	}
	connectedCallback() {
		this.style.display = "none", this.render();
	}
	disconnectedCallback() {
		this.__removeChildren();
	}
	__insertChildren() {
		I$1(I$1(this).parentNode).insertBefore(this.root, this);
	}
	__removeChildren() {
		if (this.__children) for (let t = 0; t < this.__children.length; t++) this.root.appendChild(this.__children[t]);
	}
	render() {
		let t;
		if (!this.__children) {
			if (t = t || this.querySelector("template"), !t) {
				let e = new MutationObserver((() => {
					if (t = this.querySelector("template"), !t) throw new Error("dom-bind requires a <template> child");
					e.disconnect(), this.render();
				}));
				e.observe(this, { childList: !0 });
				return;
			}
			this.root = this._stampTemplate(t), this.$ = this.root.$, this.__children = [];
			for (let t = this.root.firstChild; t; t = t.nextSibling) this.__children[this.__children.length] = t;
			this._enableProperties();
		}
		this.__insertChildren(), this.dispatchEvent(new CustomEvent("dom-change", {
			bubbles: !0,
			composed: !0
		}));
	}
});
var ur = "include";
var pr = class extends HTMLElement {
	constructor() {
		super(), this._style = null;
	}
	getStyle() {
		if (this._style) return this._style;
		const t = this.querySelector("style");
		if (!t) return null;
		this._style = t;
		const e = t.getAttribute(ur);
		return e && (t.removeAttribute(ur), t.textContent = function(t) {
			let e = t.trim().split(/\s+/), n = "";
			for (let t = 0; t < e.length; t++) n += It(e[t]);
			return n;
		}(e) + t.textContent), this.ownerDocument !== window.document && window.document.head.appendChild(this), this._style;
	}
};
window.customElements.define("custom-style", pr);
Kn(HTMLElement).prototype;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/prefs/prefs_types.js
/**
* @fileoverview Global state for prefs initialization status.
*/
var CrSettingsPrefsInternal = class {
	isInitialized = false;
	deferInitialization;
	initializedResolver_ = new PromiseResolver();
	constructor() {
		/**
		* Whether to defer initialization. Used in testing to prevent premature
		* initialization when intending to fake the settings API.
		*/
		this.deferInitialization = false;
	}
	get initialized() {
		return this.initializedResolver_.promise;
	}
	/** Resolves the |initialized| promise. */
	setInitialized() {
		this.isInitialized = true;
		this.initializedResolver_.resolve();
	}
	/** Restores state for testing. */
	resetForTesting() {
		this.isInitialized = false;
		this.initializedResolver_ = new PromiseResolver();
	}
};
var CrSettingsPrefs = new CrSettingsPrefsInternal();
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/prefs/prefs.js
/**
* @fileoverview
* 'settings-prefs' exposes a singleton model of Chrome settings and
* preferences, which listens to changes to Chrome prefs allowed in
* chrome.settingsPrivate. When changing prefs in this element's 'prefs'
* property via the UI, the singleton model tries to set those preferences in
* Chrome. Whether or not the calls to settingsPrivate.setPref succeed, 'prefs'
* is eventually consistent with the Chrome pref store.
*/
/**
* Checks whether two values are recursively equal. Only compares serializable
* data (primitives, serializable arrays and serializable objects).
* @param val1 Value to compare.
* @param val2 Value to compare with val1.
* @return Whether the values are recursively equal.
*/
function deepEqual(val1, val2) {
	if (val1 === val2) return true;
	if (Array.isArray(val1) || Array.isArray(val2)) {
		if (!Array.isArray(val1) || !Array.isArray(val2)) return false;
		return arraysEqual(val1, val2);
	}
	if (val1 instanceof Object && val2 instanceof Object) return objectsEqual(val1, val2);
	return false;
}
/**
* @return Whether the arrays are recursively equal.
*/
function arraysEqual(arr1, arr2) {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) if (!deepEqual(arr1[i], arr2[i])) return false;
	return true;
}
/**
* @return Whether the objects are recursively equal.
*/
function objectsEqual(obj1, obj2) {
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	if (keys1.length !== keys2.length) return false;
	for (let i = 0; i < keys1.length; i++) {
		const key = keys1[i];
		if (!deepEqual(obj1[key], obj2[key])) return false;
	}
	return true;
}
var SettingsPrefsElement = class extends tn {
	static get is() {
		return "settings-prefs";
	}
	static get properties() {
		return { 
		/**
		* Object containing all preferences, for use by Polymer controls.
		*/
prefs: {
			type: Object,
			notify: true
		} };
	}
	static get observers() {
		return ["prefsChanged_(prefs.*)"];
	}
	/**
	* Map of pref keys to values representing the state of the Chrome
	* pref store as of the last update from the API.
	*/
	lastPrefValues_ = /* @__PURE__ */ new Map();
	settingsApi_ = chrome.settingsPrivate;
	initialized_ = false;
	boundPrefsChanged_;
	constructor() {
		super();
		if (!CrSettingsPrefs.deferInitialization) this.initialize();
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		CrSettingsPrefs.resetForTesting();
	}
	/**
	* @param settingsApi SettingsPrivate implementation to use
	*     (chrome.settingsPrivate by default).
	*/
	initialize(settingsApi) {
		if (this.initialized_) return;
		this.initialized_ = true;
		if (settingsApi) this.settingsApi_ = settingsApi;
		this.boundPrefsChanged_ = this.onSettingsPrivatePrefsChanged_.bind(this);
		this.settingsApi_.onPrefsChanged.addListener(this.boundPrefsChanged_);
		this.settingsApi_.getAllPrefs().then((prefs) => {
			this.updatePrefs_(prefs);
			CrSettingsPrefs.setInitialized();
		});
	}
	prefsChanged_(e) {
		if (!CrSettingsPrefs.isInitialized || e.path === "prefs") return;
		const key = this.getPrefKeyFromPath_(e.path);
		const prefStoreValue = this.lastPrefValues_.get(key);
		const prefObj = this.get(key, this.prefs);
		if (!deepEqual(prefStoreValue, prefObj.value)) this.settingsApi_.setPref(key, prefObj.value, "").then((success) => {
			if (!success) this.refresh(key);
		});
	}
	/**
	* Called when prefs in the underlying Chrome pref store are changed.
	*/
	onSettingsPrivatePrefsChanged_(prefs) {
		if (CrSettingsPrefs.isInitialized) this.updatePrefs_(prefs);
	}
	/**
	* Get the current pref value from chrome.settingsPrivate to ensure the UI
	* stays up to date.
	*/
	refresh(key) {
		this.settingsApi_.getPref(key).then((pref) => {
			this.updatePrefs_([pref]);
		});
	}
	/**
	* Builds an object structure for the provided |path| within |prefsObject|,
	* ensuring that names that already exist are not overwritten. For example:
	* "a.b.c" -> a = {};a.b={};a.b.c={};
	* @param path Path to the new pref value.
	* @param value The value to expose at the end of the path.
	* @param prefsObject The prefs object to add the path to.
	*/
	updatePrefPath_(path, value, prefsObject) {
		const parts = path.split(".");
		let cur = prefsObject;
		for (let part; parts.length && (part = parts.shift());) if (!parts.length) cur[part] = value;
		else if (part in cur) cur = cur[part];
		else cur = cur[part] = {};
	}
	/**
	* Updates the prefs model with the given prefs.
	*/
	updatePrefs_(newPrefs) {
		const prefs = this.prefs || {};
		newPrefs.forEach((newPrefObj) => {
			this.lastPrefValues_.set(newPrefObj.key, structuredClone(newPrefObj.value));
			if (!deepEqual(this.get(newPrefObj.key, prefs), newPrefObj)) {
				this.updatePrefPath_(newPrefObj.key, newPrefObj, prefs);
				if (prefs === this.prefs) this.notifyPath("prefs." + newPrefObj.key, newPrefObj);
			}
		});
		if (!this.prefs) this.prefs = prefs;
	}
	/**
	* Given a 'property-changed' path, returns the key of the preference the
	* path refers to. E.g., if the path of the changed property is
	* 'prefs.search.suggest_enabled.value', the key of the pref that changed is
	* 'search.suggest_enabled'.
	*/
	getPrefKeyFromPath_(path) {
		const parts = path.split(".");
		assert$1(parts.shift() === "prefs", "Path doesn't begin with 'prefs'");
		for (let i = 1; i <= parts.length; i++) {
			const key = parts.slice(0, i).join(".");
			if (this.lastPrefValues_.has(key)) return key;
		}
		return "";
	}
	/**
	* Resets the element so it can be re-initialized with a new prefs state.
	*/
	resetForTesting() {
		if (!this.initialized_) return;
		this.prefs = void 0;
		this.lastPrefValues_.clear();
		this.initialized_ = false;
		this.settingsApi_.onPrefsChanged.removeListener(this.boundPrefsChanged_);
		this.settingsApi_ = chrome.settingsPrivate;
	}
};
customElements.define(SettingsPrefsElement.is, SettingsPrefsElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/third_party/lit/v3_0/bundled/lit.rollup.js
/**
* @license
* Copyright 2019 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
var t$3 = globalThis;
var e$3 = t$3.ShadowRoot && (void 0 === t$3.ShadyCSS || t$3.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s$3 = Symbol();
var o$4 = /* @__PURE__ */ new WeakMap();
var n$3 = class n {
	constructor(t, e, o) {
		if (this._$cssResult$ = !0, o !== s$3) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = t, this.t = e;
	}
	get styleSheet() {
		let t = this.o;
		const s = this.t;
		if (e$3 && void 0 === t) {
			const e = void 0 !== s && 1 === s.length;
			e && (t = o$4.get(s)), void 0 === t && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), e && o$4.set(s, t));
		}
		return t;
	}
	toString() {
		return this.cssText;
	}
};
var r$3 = (t) => new n$3("string" == typeof t ? t : t + "", void 0, s$3);
var i$4 = (t, ...e) => {
	return new n$3(1 === t.length ? t[0] : e.reduce(((e, s, o) => e + ((t) => {
		if (!0 === t._$cssResult$) return t.cssText;
		if ("number" == typeof t) return t;
		throw Error("Value passed to 'css' function must be a 'css' function result: " + t + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
	})(s) + t[o + 1]), t[0]), t, s$3);
};
var S$1 = (s, o) => {
	if (e$3) s.adoptedStyleSheets = o.map(((t) => t instanceof CSSStyleSheet ? t : t.styleSheet));
	else for (const e of o) {
		const o = document.createElement("style"), n = t$3.litNonce;
		void 0 !== n && o.setAttribute("nonce", n), o.textContent = e.cssText, s.appendChild(o);
	}
};
var c$3 = e$3 ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((t) => {
	let e = "";
	for (const s of t.cssRules) e += s.cssText;
	return r$3(e);
})(t) : t;
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ var { is: i$3, defineProperty: e$2, getOwnPropertyDescriptor: h$2, getOwnPropertyNames: r$2, getOwnPropertySymbols: o$3, getPrototypeOf: n$2 } = Object, a$1 = globalThis, c$2 = a$1.trustedTypes, l$1 = c$2 ? c$2.emptyScript : "", p$1 = a$1.reactiveElementPolyfillSupport, d$1 = (t, s) => t, u$1 = {
	toAttribute(t, s) {
		switch (s) {
			case Boolean:
				t = t ? l$1 : null;
				break;
			case Object:
			case Array: t = null == t ? t : JSON.stringify(t);
		}
		return t;
	},
	fromAttribute(t, s) {
		let i = t;
		switch (s) {
			case Boolean:
				i = null !== t;
				break;
			case Number:
				i = null === t ? null : Number(t);
				break;
			case Object:
			case Array: try {
				i = JSON.parse(t);
			} catch (t) {
				i = null;
			}
		}
		return i;
	}
}, f$3 = (t, s) => !i$3(t, s), b = {
	attribute: !0,
	type: String,
	converter: u$1,
	reflect: !1,
	useDefault: !1,
	hasChanged: f$3
};
Symbol.metadata ??= Symbol("metadata"), a$1.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y$1 = class y extends HTMLElement {
	static addInitializer(t) {
		this._$Ei(), (this.l ??= []).push(t);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(t, s = b) {
		if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
			const i = Symbol(), h = this.getPropertyDescriptor(t, i, s);
			void 0 !== h && e$2(this.prototype, t, h);
		}
	}
	static getPropertyDescriptor(t, s, i) {
		const { get: e, set: r } = h$2(this.prototype, t) ?? {
			get() {
				return this[s];
			},
			set(t) {
				this[s] = t;
			}
		};
		return {
			get: e,
			set(s) {
				const h = e?.call(this);
				r?.call(this, s), this.requestUpdate(t, h, i);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(t) {
		return this.elementProperties.get(t) ?? b;
	}
	static _$Ei() {
		if (this.hasOwnProperty(d$1("elementProperties"))) return;
		const t = n$2(this);
		t.finalize(), void 0 !== t.l && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(d$1("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(d$1("properties"))) {
			const t = this.properties, s = [...r$2(t), ...o$3(t)];
			for (const i of s) this.createProperty(i, t[i]);
		}
		const t = this[Symbol.metadata];
		if (null !== t) {
			const s = litPropertyMetadata.get(t);
			if (void 0 !== s) for (const [t, i] of s) this.elementProperties.set(t, i);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (const [t, s] of this.elementProperties) {
			const i = this._$Eu(t, s);
			void 0 !== i && this._$Eh.set(i, t);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(s) {
		const i = [];
		if (Array.isArray(s)) {
			const e = new Set(s.flat(1 / 0).reverse());
			for (const s of e) i.unshift(c$3(s));
		} else void 0 !== s && i.push(c$3(s));
		return i;
	}
	static _$Eu(t, s) {
		const i = s.attribute;
		return !1 === i ? void 0 : "string" == typeof i ? i : "string" == typeof t ? t.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise(((t) => this.enableUpdating = t)), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach(((t) => t(this)));
	}
	addController(t) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(t), void 0 !== this.renderRoot && this.isConnected && t.hostConnected?.();
	}
	removeController(t) {
		this._$EO?.delete(t);
	}
	_$E_() {
		const t = /* @__PURE__ */ new Map(), s = this.constructor.elementProperties;
		for (const i of s.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
		t.size > 0 && (this._$Ep = t);
	}
	createRenderRoot() {
		const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return S$1(t, this.constructor.elementStyles), t;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach(((t) => t.hostConnected?.()));
	}
	enableUpdating(t) {}
	disconnectedCallback() {
		this._$EO?.forEach(((t) => t.hostDisconnected?.()));
	}
	attributeChangedCallback(t, s, i) {
		this._$AK(t, i);
	}
	_$ET(t, s) {
		const i = this.constructor.elementProperties.get(t), e = this.constructor._$Eu(t, i);
		if (void 0 !== e && !0 === i.reflect) {
			const h = (void 0 !== i.converter?.toAttribute ? i.converter : u$1).toAttribute(s, i.type);
			this._$Em = t, null == h ? this.removeAttribute(e) : this.setAttribute(e, h), this._$Em = null;
		}
	}
	_$AK(t, s) {
		const i = this.constructor, e = i._$Eh.get(t);
		if (void 0 !== e && this._$Em !== e) {
			const t = i.getPropertyOptions(e), h = "function" == typeof t.converter ? { fromAttribute: t.converter } : void 0 !== t.converter?.fromAttribute ? t.converter : u$1;
			this._$Em = e, this[e] = h.fromAttribute(s, t.type) ?? this._$Ej?.get(e) ?? null, this._$Em = null;
		}
	}
	requestUpdate(t, s, i) {
		if (void 0 !== t) {
			const e = this.constructor, h = this[t];
			if (i ??= e.getPropertyOptions(t), !((i.hasChanged ?? f$3)(h, s) || i.useDefault && i.reflect && h === this._$Ej?.get(t) && !this.hasAttribute(e._$Eu(t, i)))) return;
			this.C(t, s, i);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(t, s, { useDefault: i, reflect: e, wrapped: h }, r) {
		i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, r ?? s ?? this[t]), !0 !== h || void 0 !== r) || (this._$AL.has(t) || (this.hasUpdated || i || (s = void 0), this._$AL.set(t, s)), !0 === e && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (t) {
			Promise.reject(t);
		}
		const t = this.scheduleUpdate();
		return null != t && await t, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (const [t, s] of this._$Ep) this[t] = s;
				this._$Ep = void 0;
			}
			const t = this.constructor.elementProperties;
			if (t.size > 0) for (const [s, i] of t) {
				const { wrapped: t } = i, e = this[s];
				!0 !== t || this._$AL.has(s) || void 0 === e || this.C(s, void 0, i, e);
			}
		}
		let t = !1;
		const s = this._$AL;
		try {
			t = this.shouldUpdate(s), t ? (this.willUpdate(s), this._$EO?.forEach(((t) => t.hostUpdate?.())), this.update(s)) : this._$EM();
		} catch (s) {
			throw t = !1, this._$EM(), s;
		}
		t && this._$AE(s);
	}
	willUpdate(t) {}
	_$AE(t) {
		this._$EO?.forEach(((t) => t.hostUpdated?.())), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(t) {
		return !0;
	}
	update(t) {
		this._$Eq &&= this._$Eq.forEach(((t) => this._$ET(t, this[t]))), this._$EM();
	}
	updated(t) {}
	firstUpdated(t) {}
};
y$1.elementStyles = [], y$1.shadowRootOptions = { mode: "open" }, y$1[d$1("elementProperties")] = /* @__PURE__ */ new Map(), y$1[d$1("finalized")] = /* @__PURE__ */ new Map(), p$1?.({ ReactiveElement: y$1 }), (a$1.reactiveElementVersions ??= []).push("2.1.0");
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
var t$2 = globalThis;
var i$2 = t$2.trustedTypes;
var s$2 = i$2 ? i$2.createPolicy("lit-html-desktop", { createHTML: (t) => t }) : void 0;
var e$1 = "$lit$";
var h$1 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var o$2 = "?" + h$1;
var n$1 = `<${o$2}>`;
var r$1 = document;
var l = () => r$1.createComment("");
var c$1 = (t) => null === t || "object" != typeof t && "function" != typeof t;
var a = Array.isArray;
var u = (t) => a(t) || "function" == typeof t?.[Symbol.iterator];
var d = "[ 	\n\f\r]";
var f$2 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var v = /-->/g;
var _ = />/g;
var m = RegExp(`>|${d}(?:([^\\s"'>=/]+)(${d}*=${d}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g");
var p = /'/g;
var g = /"/g;
var $ = /^(?:script|style|textarea|title)$/i;
var y = (t) => (i, ...s) => ({
	_$litType$: t,
	strings: i,
	values: s
});
var x = y(1);
var T = Symbol.for("lit-noChange");
var E = Symbol.for("lit-nothing");
var A = /* @__PURE__ */ new WeakMap();
var C = r$1.createTreeWalker(r$1, 129);
function P(t, i) {
	if (!a(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return void 0 !== s$2 ? s$2.createHTML(i) : i;
}
var V = (t, i) => {
	const s = t.length - 1, o = [];
	let r, l = 2 === i ? "<svg>" : 3 === i ? "<math>" : "", c = f$2;
	for (let i = 0; i < s; i++) {
		const s = t[i];
		let a, u, d = -1, y = 0;
		for (; y < s.length && (c.lastIndex = y, u = c.exec(s), null !== u);) y = c.lastIndex, c === f$2 ? "!--" === u[1] ? c = v : void 0 !== u[1] ? c = _ : void 0 !== u[2] ? ($.test(u[2]) && (r = RegExp("</" + u[2], "g")), c = m) : void 0 !== u[3] && (c = m) : c === m ? ">" === u[0] ? (c = r ?? f$2, d = -1) : void 0 === u[1] ? d = -2 : (d = c.lastIndex - u[2].length, a = u[1], c = void 0 === u[3] ? m : "\"" === u[3] ? g : p) : c === g || c === p ? c = m : c === v || c === _ ? c = f$2 : (c = m, r = void 0);
		const x = c === m && t[i + 1].startsWith("/>") ? " " : "";
		l += c === f$2 ? s + n$1 : d >= 0 ? (o.push(a), s.slice(0, d) + e$1 + s.slice(d) + h$1 + x) : s + h$1 + (-2 === d ? i : x);
	}
	return [P(t, l + (t[s] || "<?>") + (2 === i ? "</svg>" : 3 === i ? "</math>" : "")), o];
};
var N = class N {
	constructor({ strings: t, _$litType$: s }, n) {
		let r;
		this.parts = [];
		let c = 0, a = 0;
		const u = t.length - 1, d = this.parts, [f, v] = V(t, s);
		if (this.el = N.createElement(f, n), C.currentNode = this.el.content, 2 === s || 3 === s) {
			const t = this.el.content.firstChild;
			t.replaceWith(...t.childNodes);
		}
		for (; null !== (r = C.nextNode()) && d.length < u;) {
			if (1 === r.nodeType) {
				if (r.hasAttributes()) for (const t of r.getAttributeNames()) if (t.endsWith(e$1)) {
					const i = v[a++], s = r.getAttribute(t).split(h$1), e = /([.?@])?(.*)/.exec(i);
					d.push({
						type: 1,
						index: c,
						name: e[2],
						strings: s,
						ctor: "." === e[1] ? H : "?" === e[1] ? I : "@" === e[1] ? L : k
					}), r.removeAttribute(t);
				} else t.startsWith(h$1) && (d.push({
					type: 6,
					index: c
				}), r.removeAttribute(t));
				if ($.test(r.tagName)) {
					const t = r.textContent.split(h$1), s = t.length - 1;
					if (s > 0) {
						r.textContent = i$2 ? i$2.emptyScript : "";
						for (let i = 0; i < s; i++) r.append(t[i], l()), C.nextNode(), d.push({
							type: 2,
							index: ++c
						});
						r.append(t[s], l());
					}
				}
			} else if (8 === r.nodeType) if (r.data === o$2) d.push({
				type: 2,
				index: c
			});
			else {
				let t = -1;
				for (; -1 !== (t = r.data.indexOf(h$1, t + 1));) d.push({
					type: 7,
					index: c
				}), t += h$1.length - 1;
			}
			c++;
		}
	}
	static createElement(t, i) {
		const s = r$1.createElement("template");
		return s.innerHTML = t, s;
	}
};
function S(t, i, s = t, e) {
	if (i === T) return i;
	let h = void 0 !== e ? s._$Co?.[e] : s._$Cl;
	const o = c$1(i) ? void 0 : i._$litDirective$;
	return h?.constructor !== o && (h?._$AO?.(!1), void 0 === o ? h = void 0 : (h = new o(t), h._$AT(t, s, e)), void 0 !== e ? (s._$Co ??= [])[e] = h : s._$Cl = h), void 0 !== h && (i = S(t, h._$AS(t, i.values), h, e)), i;
}
var M = class {
	constructor(t, i) {
		this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = i;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(t) {
		const { el: { content: i }, parts: s } = this._$AD, e = (t?.creationScope ?? r$1).importNode(i, !0);
		C.currentNode = e;
		let h = C.nextNode(), o = 0, n = 0, l = s[0];
		for (; void 0 !== l;) {
			if (o === l.index) {
				let i;
				2 === l.type ? i = new R(h, h.nextSibling, this, t) : 1 === l.type ? i = new l.ctor(h, l.name, l.strings, this, t) : 6 === l.type && (i = new z(h, this, t)), this._$AV.push(i), l = s[++n];
			}
			o !== l?.index && (h = C.nextNode(), o++);
		}
		return C.currentNode = r$1, e;
	}
	p(t) {
		let i = 0;
		for (const s of this._$AV) void 0 !== s && (void 0 !== s.strings ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
	}
};
var R = class R {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(t, i, s, e) {
		this.type = 2, this._$AH = E, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = e, this._$Cv = e?.isConnected ?? !0;
	}
	get parentNode() {
		let t = this._$AA.parentNode;
		const i = this._$AM;
		return void 0 !== i && 11 === t?.nodeType && (t = i.parentNode), t;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(t, i = this) {
		t = S(this, t, i), c$1(t) ? t === E || null == t || "" === t ? (this._$AH !== E && this._$AR(), this._$AH = E) : t !== this._$AH && t !== T && this._(t) : void 0 !== t._$litType$ ? this.$(t) : void 0 !== t.nodeType ? this.T(t) : u(t) ? this.k(t) : this._(t);
	}
	O(t) {
		return this._$AA.parentNode.insertBefore(t, this._$AB);
	}
	T(t) {
		this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
	}
	_(t) {
		this._$AH !== E && c$1(this._$AH) ? this._$AA.nextSibling.data = t : this.T(r$1.createTextNode(t)), this._$AH = t;
	}
	$(t) {
		const { values: i, _$litType$: s } = t, e = "number" == typeof s ? this._$AC(t) : (void 0 === s.el && (s.el = N.createElement(P(s.h, s.h[0]), this.options)), s);
		if (this._$AH?._$AD === e) this._$AH.p(i);
		else {
			const t = new M(e, this), s = t.u(this.options);
			t.p(i), this.T(s), this._$AH = t;
		}
	}
	_$AC(t) {
		let i = A.get(t.strings);
		return void 0 === i && A.set(t.strings, i = new N(t)), i;
	}
	k(t) {
		a(this._$AH) || (this._$AH = [], this._$AR());
		const i = this._$AH;
		let s, e = 0;
		for (const h of t) e === i.length ? i.push(s = new R(this.O(l()), this.O(l()), this, this.options)) : s = i[e], s._$AI(h), e++;
		e < i.length && (this._$AR(s && s._$AB.nextSibling, e), i.length = e);
	}
	_$AR(t = this._$AA.nextSibling, i) {
		for (this._$AP?.(!1, !0, i); t && t !== this._$AB;) {
			const i = t.nextSibling;
			t.remove(), t = i;
		}
	}
	setConnected(t) {
		void 0 === this._$AM && (this._$Cv = t, this._$AP?.(t));
	}
};
var k = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(t, i, s, e, h) {
		this.type = 1, this._$AH = E, this._$AN = void 0, this.element = t, this.name = i, this._$AM = e, this.options = h, s.length > 2 || "" !== s[0] || "" !== s[1] ? (this._$AH = Array(s.length - 1).fill(/* @__PURE__ */ new String()), this.strings = s) : this._$AH = E;
	}
	_$AI(t, i = this, s, e) {
		const h = this.strings;
		let o = !1;
		if (void 0 === h) t = S(this, t, i, 0), o = !c$1(t) || t !== this._$AH && t !== T, o && (this._$AH = t);
		else {
			const e = t;
			let n, r;
			for (t = h[0], n = 0; n < h.length - 1; n++) r = S(this, e[s + n], i, n), r === T && (r = this._$AH[n]), o ||= !c$1(r) || r !== this._$AH[n], r === E ? t = E : t !== E && (t += (r ?? "") + h[n + 1]), this._$AH[n] = r;
		}
		o && !e && this.j(t);
	}
	j(t) {
		t === E ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
	}
};
var H = class extends k {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(t) {
		this.element[this.name] = t === E ? void 0 : t;
	}
};
var I = class extends k {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(t) {
		this.element.toggleAttribute(this.name, !!t && t !== E);
	}
};
var L = class extends k {
	constructor(t, i, s, e, h) {
		super(t, i, s, e, h), this.type = 5;
	}
	_$AI(t, i = this) {
		if ((t = S(this, t, i, 0) ?? E) === T) return;
		const s = this._$AH, e = t === E && s !== E || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, h = t !== E && (s === E || e);
		e && this.element.removeEventListener(this.name, this, s), h && this.element.addEventListener(this.name, this, t), this._$AH = t;
	}
	handleEvent(t) {
		"function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
	}
};
var z = class {
	constructor(t, i, s) {
		this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(t) {
		S(this, t);
	}
};
var j = t$2.litHtmlPolyfillSupport;
j?.(N, R), (t$2.litHtmlVersions ??= []).push("3.3.0");
var B = (t, i, s) => {
	const e = s?.renderBefore ?? i;
	let h = e._$litPart$;
	if (void 0 === h) {
		const t = s?.renderBefore ?? null;
		e._$litPart$ = h = new R(i.insertBefore(l(), t), t, void 0, s ?? {});
	}
	return h._$AI(t), h;
};
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ var s$1 = globalThis;
var i$1 = class i extends y$1 {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		const t = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= t.firstChild, t;
	}
	update(t) {
		const r = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = B(r, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return T;
	}
};
i$1._$litElement$ = !0, i$1["finalized"] = !0, s$1.litElementHydrateSupport?.({ LitElement: i$1 });
var o$1 = s$1.litElementPolyfillSupport;
o$1?.({ LitElement: i$1 });
(s$1.litElementVersions ??= []).push("4.2.0");
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
/**
* @license
* Copyright 2020 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
function toDashCase(name) {
	return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
var CrLitElement = class extends i$1 {
	$;
	willUpdatePending_ = false;
	static notifyProps_ = null;
	constructor() {
		super();
		const self = this;
		this.$ = new Proxy({}, { get(cache, id) {
			if (!self.hasUpdated && !self.isConnected) {
				const description = self.tagName + (self.id ? `#${self.id}` : "");
				throw new Error(`CrLitElement ${description} accessed '$.${id}' before connected at least once.`);
			}
			if (!self.hasUpdated) {
				if (self.willUpdatePending_) {
					const description = self.tagName + (self.id ? `#${self.id}` : "");
					throw new Error(`CrLitElement ${description} accessed '$.${id}' within willUpdate().`);
				}
				self.performUpdate();
			}
			if (id in cache) return cache[id];
			const element = self.shadowRoot.querySelector(`#${id}`);
			if (element === null) throw new Error(`CrLitElement ${self.tagName}: Failed to find child with id ${id}`);
			cache[id] = element;
			return element;
		} });
	}
	ensureInitialRender() {
		if (!this.hasUpdated) this.performUpdate();
	}
	connectedCallback() {
		super.connectedCallback();
		this.ensureInitialRender();
	}
	willUpdate(_changedProperties) {
		this.willUpdatePending_ = true;
	}
	updated(changedProperties) {
		this.willUpdatePending_ = false;
		const notifyProps = this.constructor.notifyProps_;
		if (notifyProps !== null) {
			const indexableThis = this;
			for (const key of changedProperties.keys()) if (notifyProps.has(key)) {
				if (changedProperties.get(key) === void 0 && indexableThis[key] === void 0) continue;
				this.dispatchEvent(new CustomEvent(`${toDashCase(key.toString())}-changed`, { detail: { value: indexableThis[key] } }));
			}
		}
	}
	focus(options) {
		this.ensureInitialRender();
		super.focus(options);
	}
	fire(eventName, detail) {
		this.dispatchEvent(new CustomEvent(eventName, {
			bubbles: true,
			composed: true,
			detail
		}));
	}
	static patchPropertiesObject() {
		if (!this.hasOwnProperty("properties")) return;
		const properties = this.properties;
		for (const [key, value] of Object.entries(properties)) if (value.attribute == null) value.attribute = toDashCase(key);
		Object.defineProperty(this, "properties", { value: properties });
	}
	static populateNotifyProps() {
		if (!this.hasOwnProperty("properties")) return;
		for (const [key, value] of Object.entries(this.properties)) if (value.notify) {
			if (this.notifyProps_ === null) this.notifyProps_ = /* @__PURE__ */ new Set();
			this.notifyProps_.add(key);
		}
	}
	static finalize() {
		this.patchPropertiesObject();
		this.populateNotifyProps();
		super.finalize();
	}
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon/iconset_map.js
var iconsetMap = null;
var IconsetMap = class IconsetMap extends EventTarget {
	iconsets_ = /* @__PURE__ */ new Map();
	static getInstance() {
		return iconsetMap || (iconsetMap = new IconsetMap());
	}
	static resetInstanceForTesting(instance) {
		iconsetMap = instance;
	}
	get(id) {
		return this.iconsets_.get(id) || null;
	}
	set(id, iconset) {
		assert$1(!this.iconsets_.has(id), `Tried to add a second iconset with id '${id}'`);
		this.iconsets_.set(id, iconset);
		this.dispatchEvent(new CustomEvent("cr-iconset-added", { detail: id }));
	}
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon/cr_iconset.css.js
var instance$35 = null;
function getCss$14() {
	return instance$35 || (instance$35 = [...[], i$4`:host{display:none}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon/cr_iconset.html.js
function getHtml$8() {
	return x`
<svg id="baseSvg" xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${this.size} ${this.size}"
     preserveAspectRatio="xMidYMid meet" focusable="false"
     style="pointer-events: none; display: block; width: 100%; height: 100%;">
 </svg>
<slot></slot>
`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon/cr_iconset.js
var APPLIED_ICON_CLASS = "cr-iconset-svg-icon_";
var CrIconsetElement = class extends CrLitElement {
	static get is() {
		return "cr-iconset";
	}
	static get styles() {
		return getCss$14();
	}
	render() {
		return getHtml$8.bind(this)();
	}
	static get properties() {
		return {
			/**
			* The name of the iconset.
			*/
			name: { type: String },
			/**
			* The size of an individual icon. Note that icons must be square.
			*/
			size: { type: Number }
		};
	}
	#name_accessor_storage = "";
	get name() {
		return this.#name_accessor_storage;
	}
	set name(value) {
		this.#name_accessor_storage = value;
	}
	#size_accessor_storage = 24;
	get size() {
		return this.#size_accessor_storage;
	}
	set size(value) {
		this.#size_accessor_storage = value;
	}
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("name")) {
			assert$1(changedProperties.get("name") === void 0);
			IconsetMap.getInstance().set(this.name, this);
		}
	}
	/**
	* Applies an icon to the given element.
	*
	* An svg icon is prepended to the element's shadowRoot, which should always
	* exist.
	* @param element Element to which the icon is applied.
	* @param iconName Name of the icon to apply.
	* @return The svg element which renders the icon.
	*/
	applyIcon(element, iconName) {
		this.removeIcon(element);
		const svg = this.cloneIcon_(iconName);
		if (svg) {
			svg.classList.add(APPLIED_ICON_CLASS);
			element.shadowRoot.insertBefore(svg, element.shadowRoot.childNodes[0]);
			return svg;
		}
		return null;
	}
	/**
	* Produce installable clone of the SVG element matching `id` in this
	* iconset, or null if there is no matching element.
	* @param iconName Name of the icon to apply.
	*/
	createIcon(iconName) {
		return this.cloneIcon_(iconName);
	}
	/**
	* Remove an icon from the given element by undoing the changes effected
	* by `applyIcon`.
	*/
	removeIcon(element) {
		const oldSvg = element.shadowRoot.querySelector(`.${APPLIED_ICON_CLASS}`);
		if (oldSvg) oldSvg.remove();
	}
	/**
	* Produce installable clone of the SVG element matching `id` in this
	* iconset, or `undefined` if there is no matching element.
	*
	* Returns an installable clone of the SVG element matching `id` or null if
	* no such element exists.
	*/
	cloneIcon_(id) {
		const sourceSvg = this.querySelector(`g[id="${id}"]`);
		if (!sourceSvg) return null;
		const svgClone = this.$.baseSvg.cloneNode(true);
		const content = sourceSvg.cloneNode(true);
		content.removeAttribute("id");
		const contentViewBox = content.getAttribute("viewBox");
		if (contentViewBox) svgClone.setAttribute("viewBox", contentViewBox);
		svgClone.appendChild(content);
		return svgClone;
	}
};
customElements.define(CrIconsetElement.is, CrIconsetElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/static_types.js
/**
* @return Whether the passed tagged template literal is a valid array.
*/
function isValidArray(arr) {
	if (arr instanceof Array && Object.isFrozen(arr)) return true;
	return false;
}
/**
* Checks if the passed tagged template literal only contains static string.
* And return the string in the literal if so.
* Throws an Error if the passed argument is not supported literals.
*/
function getStaticString(literal) {
	assert$1(isValidArray(literal) && !!literal.raw && isValidArray(literal.raw) && literal.length === literal.raw.length && literal.length === 1, "static_types.js only allows static strings");
	return literal.join("");
}
function createTypes(_ignore, literal) {
	return getStaticString(literal);
}
/**
* Rules used to enforce static literal checks.
*/
var rules = {
	createHTML: createTypes,
	createScript: createTypes,
	createScriptURL: createTypes
};
/**
* This policy returns Trusted Types if the passed literal is static.
*/
var staticPolicy;
if (window.trustedTypes) staticPolicy = window.trustedTypes.createPolicy("static-types", rules);
else staticPolicy = rules;
/**
* Returns TrustedHTML if the passed literal is static.
*/
function getTrustedHTML(literal) {
	return staticPolicy.createHTML("", literal);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/icons.html.js
var div$2 = document.createElement("div");
div$2.innerHTML = getTrustedHTML`<!--
List icons here rather than importing large sets of (e.g. Polymer) icons.
Keep in alphabetical ordering.
NOTE: Chrome OS icons go in ./chromeos/os_icons.html.
-->
<cr-iconset name="settings20" size="20">
  <svg>
    <defs>
      <g id="account-box"><path d="M4.5 14.3958C5.27778 13.7569 6.13889 13.2847 7.08333 12.9792C8.02778 12.6597 9 12.5 10 12.5C11 12.5 11.9722 12.6528 12.9167 12.9583C13.8611 13.2639 14.7222 13.7431 15.5 14.3958V4.5H4.5V14.3958ZM10 11.5C10.8333 11.5 11.5417 11.2083 12.125 10.625C12.7083 10.0417 13 9.33333 13 8.5C13 7.66667 12.7083 6.95833 12.125 6.375C11.5417 5.79167 10.8333 5.5 10 5.5C9.16667 5.5 8.45833 5.79167 7.875 6.375C7.29167 6.95833 7 7.66667 7 8.5C7 9.33333 7.29167 10.0417 7.875 10.625C8.45833 11.2083 9.16667 11.5 10 11.5ZM4.5 17C4.08333 17 3.72917 16.8542 3.4375 16.5625C3.14583 16.2708 3 15.9167 3 15.5V4.5C3 4.08333 3.14583 3.72917 3.4375 3.4375C3.72917 3.14583 4.08333 3 4.5 3H15.5C15.9167 3 16.2708 3.14583 16.5625 3.4375C16.8542 3.72917 17 4.08333 17 4.5V15.5C17 15.9167 16.8542 16.2708 16.5625 16.5625C16.2708 16.8542 15.9167 17 15.5 17H4.5ZM5.52083 15.5H14.4792C13.8403 15.0139 13.1389 14.6458 12.375 14.3958C11.6111 14.1319 10.8194 14 10 14C9.18056 14 8.38889 14.1319 7.625 14.3958C6.875 14.6458 6.17361 15.0139 5.52083 15.5ZM10 10C9.58333 10 9.22917 9.85417 8.9375 9.5625C8.64583 9.27083 8.5 8.91667 8.5 8.5C8.5 8.08333 8.64583 7.72917 8.9375 7.4375C9.22917 7.14583 9.58333 7 10 7C10.4167 7 10.7708 7.14583 11.0625 7.4375C11.3542 7.72917 11.5 8.08333 11.5 8.5C11.5 8.91667 11.3542 9.27083 11.0625 9.5625C10.7708 9.85417 10.4167 10 10 10Z"></path></g>
      <g id="account-circle"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 1.667A8.336 8.336 0 0 0 1.667 10c0 4.6 3.733 8.333 8.333 8.333S18.333 14.6 18.333 10 14.6 1.667 10 1.667zM5.89 15.233c.359-.75 2.542-1.483 4.109-1.483 1.566 0 3.758.733 4.108 1.483A6.578 6.578 0 0 1 10 16.667a6.577 6.577 0 0 1-4.109-1.434zM10 12.083c1.216 0 4.108.492 5.3 1.942A6.625 6.625 0 0 0 16.666 10 6.676 6.676 0 0 0 10 3.333 6.676 6.676 0 0 0 3.333 10c0 1.517.517 2.908 1.367 4.025 1.191-1.45 4.083-1.942 5.3-1.942zM10 5a2.91 2.91 0 0 0-2.917 2.917A2.91 2.91 0 0 0 10 10.833a2.91 2.91 0 0 0 2.916-2.916A2.91 2.91 0 0 0 10 5zM8.75 7.917c0 .691.558 1.25 1.25 1.25.691 0 1.25-.559 1.25-1.25 0-.692-.559-1.25-1.25-1.25-.692 0-1.25.558-1.25 1.25z"></path></g>
      <g id="account-circle-filled" viewBox="0 -960 960 960"><path d="M237-285q54-38 115.5-56.5T480-360q66 0 127.5 18.5T723-285q35-41 52-91t17-104q0-129.67-91.23-220.84-91.23-91.16-221-91.16Q350-792 259-700.84 168-609.67 168-480q0 54 17 104t52 91Zm243-123q-60 0-102-42t-42-102q0-60 42-102t102-42q60 0 102 42t42 102q0 60-42 102t-102 42Zm.28 312Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Z"></path></g>
      <g id="archive"><path d="M4.5 17C4.08333 17 3.72917 16.8542 3.4375 16.5625C3.14583 16.2708 3 15.9167 3 15.5V5.625C3 5.43055 3.03472 5.24306 3.10417 5.0625C3.1875 4.86805 3.29861 4.70139 3.4375 4.5625L4.5625 3.4375C4.70139 3.29861 4.86111 3.19444 5.04167 3.125C5.23611 3.04167 5.43056 3 5.625 3H14.375C14.5694 3 14.7569 3.04167 14.9375 3.125C15.1319 3.19444 15.2986 3.29861 15.4375 3.4375L16.5625 4.5625C16.7014 4.70139 16.8056 4.86805 16.875 5.0625C16.9583 5.24306 17 5.43055 17 5.625V15.5C17 15.9167 16.8542 16.2708 16.5625 16.5625C16.2708 16.8542 15.9167 17 15.5 17H4.5ZM4.625 5.5H15.375L14.375 4.5H5.625L4.625 5.5ZM4.5 7V15.5H15.5V7H4.5ZM10 14.25L13 11.25L11.9375 10.1875L10.75 11.375V8.25H9.25V11.375L8.0625 10.1875L7 11.25L10 14.25ZM4.5 15.5H15.5H4.5Z"></path></g>
      <g id="arrow-selector-tool" viewBox="0 -960 960 960"><path d="m320-410 79-110h170L320-716v306ZM551-80 406-392 240-160v-720l560 440H516l144 309-109 51ZM399-520Z"></path></g>
      <g id="auto-delete"><path d="M6.5 5.5v10ZM9.396 17H6.5q-.625 0-1.062-.438Q5 16.125 5 15.5v-10H4V4h4V3h4v1h4v1.5h-1v3.104q-.375-.062-.75-.094-.375-.031-.75.011V5.5h-7v10h2.208q.104.396.282.771.177.375.406.729ZM8 14h.5q0-1.458.5-2.312l.5-.855V7H8Zm2.5-4.25q.292-.229.677-.469.385-.239.823-.406V7h-1.5ZM14 18q-1.667 0-2.833-1.167Q10 15.667 10 14q0-1.667 1.167-2.833Q12.333 10 14 10q1.667 0 2.833 1.167Q18 12.333 18 14q0 1.667-1.167 2.833Q15.667 18 14 18Zm1.146-2.146.708-.708-1.354-1.354V12h-1v2.208Z"></path></g>
      <g id="auto-summarize"><path d="M5.83333 9.16665V7.49998H10.8333V9.16665H5.83333ZM5.83333 12.5V10.8333H17.5V12.5H5.83333ZM5.83333 15.8333V14.1666H17.5V15.8333H5.83333ZM3.33333 9.16665C3.09722 9.16665 2.89931 9.08679 2.73958 8.92706C2.57986 8.76734 2.5 8.56942 2.5 8.33331C2.5 8.0972 2.57986 7.89929 2.73958 7.73956C2.89931 7.57984 3.09722 7.49998 3.33333 7.49998C3.56944 7.49998 3.76736 7.57984 3.92708 7.73956C4.08681 7.89929 4.16667 8.0972 4.16667 8.33331C4.16667 8.56942 4.08681 8.76734 3.92708 8.92706C3.76736 9.08679 3.56944 9.16665 3.33333 9.16665ZM3.33333 12.5C3.09722 12.5 2.89931 12.4201 2.73958 12.2604C2.57986 12.1007 2.5 11.9028 2.5 11.6666C2.5 11.4305 2.57986 11.2326 2.73958 11.0729C2.89931 10.9132 3.09722 10.8333 3.33333 10.8333C3.56944 10.8333 3.76736 10.9132 3.92708 11.0729C4.08681 11.2326 4.16667 11.4305 4.16667 11.6666C4.16667 11.9028 4.08681 12.1007 3.92708 12.2604C3.76736 12.4201 3.56944 12.5 3.33333 12.5ZM3.33333 15.8333C3.09722 15.8333 2.89931 15.7535 2.73958 15.5937C2.57986 15.434 2.5 15.2361 2.5 15C2.5 14.7639 2.57986 14.566 2.73958 14.4062C2.89931 14.2465 3.09722 14.1666 3.33333 14.1666C3.56944 14.1666 3.76736 14.2465 3.92708 14.4062C4.08681 14.566 4.16667 14.7639 4.16667 15C4.16667 15.2361 4.08681 15.434 3.92708 15.5937C3.76736 15.7535 3.56944 15.8333 3.33333 15.8333ZM14.5833 9.99998C14.5833 8.7222 15.0278 7.63887 15.9167 6.74998C16.8056 5.86109 17.8889 5.41665 19.1667 5.41665C17.8889 5.41665 16.8056 4.9722 15.9167 4.08331C15.0278 3.19442 14.5833 2.11109 14.5833 0.833313C14.5833 2.11109 14.1389 3.19442 13.25 4.08331C12.3611 4.9722 11.2778 5.41665 10 5.41665C11.2778 5.41665 12.3611 5.86109 13.25 6.74998C14.1389 7.63887 14.5833 8.7222 14.5833 9.99998Z"></path></g>
      <g id="auto-tab-group"><path d="M6.5 3.5C6.5 3.81944 6.5 4.14583 6.5 4.47917C6.5 4.8125 6.5 5.15972 6.5 5.52083C6.5 7.03472 6.5 8.32639 6.5 9.39583C6.5 10.4653 6.5 11 6.5 11C6.5 11 6.5 10.9653 6.5 10.8958C6.5 10.8264 6.5 10.7292 6.5 10.6042V13.5V3.5ZM3.5 18C3.08333 18 2.72917 17.8542 2.4375 17.5625C2.14583 17.2708 2 16.9167 2 16.5V5H3.5V16.5H15V18H3.5ZM6.5 15C6.08333 15 5.72917 14.8542 5.4375 14.5625C5.14583 14.2708 5 13.9167 5 13.5V3.5C5 3.08333 5.14583 2.72917 5.4375 2.4375C5.72917 2.14583 6.08333 2 6.5 2H10.2708C10.0764 2.22222 9.90278 2.45833 9.75 2.70833C9.61111 2.95833 9.48611 3.22222 9.375 3.5H6.5V13.5H16.5V10.6042C16.7778 10.4931 17.0417 10.3681 17.2917 10.2292C17.5417 10.0764 17.7778 9.90278 18 9.70833V13.5C18 13.9167 17.8542 14.2708 17.5625 14.5625C17.2708 14.8542 16.9167 15 16.5 15H6.5ZM14.5 10C14.5 8.75 14.0625 7.6875 13.1875 6.8125C12.3125 5.9375 11.25 5.5 10 5.5C11.25 5.5 12.3125 5.0625 13.1875 4.1875C14.0625 3.3125 14.5 2.25 14.5 0.999999C14.5 2.25 14.9375 3.3125 15.8125 4.1875C16.6875 5.0625 17.75 5.5 19 5.5C17.75 5.5 16.6875 5.9375 15.8125 6.8125C14.9375 7.6875 14.5 8.75 14.5 10Z"></path></g>
      <g id="background-replace"><path d="M3 8.104V6.333L6.333 3h1.792Zm0-3.896V3h1.208Zm10.188 1.521Q13 5.5 12.76 5.281q-.239-.219-.51-.385L14.167 3h1.791Zm-8.73 6.938 2.063-2.042q.167.25.364.458.198.209.365.375l-.25.25q-.625.146-1.312.407-.688.26-1.23.552Zm9.667-3.979q0-.021.021-.136.021-.114.021-.156 0-.354-.052-.688-.053-.333-.157-.625L17 4.062v1.771Zm-5.354-4.23L10.271 3h1.771l-1.313 1.312q-.187-.041-.364-.052-.177-.01-.344-.01-.354 0-.667.052-.312.052-.583.156Zm-5.729 7.521v-1.771l3.062-3.041q-.104.291-.166.604-.063.312-.063.625 0 .166.01.333.011.167.053.354Zm13.729 1.833q-.167-.25-.365-.479-.198-.229-.489-.416L17 11.854v1.75ZM14.5 12.188q-.125-.042-.292-.105-.166-.062-.312-.104-.167-.062-.354-.114-.188-.053-.375-.094L17 7.938v1.791Zm-4.479-.688q-1.313 0-2.219-.917-.906-.916-.906-2.187 0-1.292.906-2.208.906-.917 2.219-.917 1.291 0 2.198.917.906.916.906 2.208 0 1.271-.906 2.187-.907.917-2.198.917Zm0-1.5q.667 0 1.135-.469.469-.469.469-1.135 0-.667-.469-1.146-.468-.479-1.135-.479t-1.146.479q-.479.479-.479 1.146 0 .666.479 1.135t1.146.469ZM4 17v-1.5q0-.604.323-1.125t.865-.813q1.124-.583 2.333-.895 1.208-.313 2.479-.313 1.25 0 2.458.313 1.209.312 2.334.895.541.292.875.813.333.521.333 1.125V17Zm1.5-1.5h9q0-.208-.125-.354t-.292-.25q-.937-.5-1.979-.771T10 13.854q-1.062 0-2.104.261-1.042.26-1.979.76-.188.104-.302.26-.115.157-.115.365Z"></path></g>
      <g id="bar-chart"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 16V8h3v8Zm4.5 0V4h3v12Zm4.5 0v-6h3v6Z"></path></g>
      <g id="block"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.99984 1.66667C5.39984 1.66667 1.6665 5.40001 1.6665 10C1.6665 14.6 5.39984 18.3333 9.99984 18.3333C14.5998 18.3333 18.3332 14.6 18.3332 10C18.3332 5.40001 14.5998 1.66667 9.99984 1.66667ZM3.33317 10C3.33317 6.31667 6.3165 3.33334 9.99984 3.33334C11.5415 3.33334 12.9582 3.85834 14.0832 4.74167L4.7415 14.0833C3.85817 12.9583 3.33317 11.5417 3.33317 10ZM5.9165 15.2583C7.0415 16.1417 8.45817 16.6667 9.99984 16.6667C13.6832 16.6667 16.6665 13.6833 16.6665 10C16.6665 8.45834 16.1415 7.04167 15.2582 5.91667L5.9165 15.2583Z"></path></g>
      <g id="broken"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.8333 2.5H4.16667C3.25 2.5 2.5 3.25 2.5 4.16667V15.8333C2.5 16.75 3.25 17.5 4.16667 17.5H15.8333C16.75 17.5 17.5 16.75 17.5 15.8333V4.16667C17.5 3.25 16.75 2.5 15.8333 2.5ZM15.8333 4.16667V9.29167L14 7L11.3333 10.3333L8.66667 7L6 10.3333L4.16667 8.04167V4.16667H15.8333ZM4.16667 10.7083V15.8333H15.8417V11.9583L14.0083 9.66667L11.3333 13L8.66667 9.66667L6 13L4.16667 10.7083Z"></path></g>
      <g id="center-focus-strong"><path d="M 4.5 17 C 4.085938 17 3.734375 16.851562 3.441406 16.558594 C 3.148438 16.265625 3 15.914062 3 15.5 L 3 12 L 4.5 12 L 4.5 15.5 L 8 15.5 L 8 17 Z M 12 17 L 12 15.5 L 15.5 15.5 L 15.5 12 L 17 12 L 17 15.5 C 17 15.914062 16.851562 16.265625 16.558594 16.558594 C 16.265625 16.851562 15.914062 17 15.5 17 Z M 3 8 L 3 4.5 C 3 4.085938 3.148438 3.734375 3.441406 3.441406 C 3.734375 3.148438 4.085938 3 4.5 3 L 8 3 L 8 4.5 L 4.5 4.5 L 4.5 8 Z M 15.5 8 L 15.5 4.5 L 12 4.5 L 12 3 L 15.5 3 C 15.914062 3 16.265625 3.148438 16.558594 3.441406 C 16.851562 3.734375 17 4.085938 17 4.5 L 17 8 Z M 9.996094 14 C 8.886719 14 7.945312 13.609375 7.167969 12.828125 C 6.390625 12.046875 6 11.101562 6 9.996094 C 6 8.886719 6.390625 7.945312 7.171875 7.167969 C 7.953125 6.390625 8.898438 6 10.003906 6 C 11.113281 6 12.054688 6.390625 12.832031 7.171875 C 13.609375 7.953125 14 8.898438 14 10.003906 C 14 11.113281 13.609375 12.054688 12.828125 12.832031 C 12.046875 13.609375 11.101562 14 9.996094 14 Z M 10 12.5 C 10.695312 12.5 11.285156 12.257812 11.769531 11.769531 C 12.257812 11.285156 12.5 10.695312 12.5 10 C 12.5 9.304688 12.257812 8.714844 11.769531 8.230469 C 11.285156 7.742188 10.695312 7.5 10 7.5 C 9.304688 7.5 8.714844 7.742188 8.230469 8.230469 C 7.742188 8.714844 7.5 9.304688 7.5 10 C 7.5 10.695312 7.742188 11.285156 8.230469 11.769531 C 8.714844 12.257812 9.304688 12.5 10 12.5 Z M 10 10 Z M 10 10 "></path></g>
      <g id="checklist"><path d="M4.833 15.5 2 12.667l1.062-1.063 1.75 1.771 3.542-3.542 1.084 1.063Zm0-6.5L2 6.167l1.062-1.063 1.771 1.771 3.521-3.542 1.084 1.063ZM11 14v-1.5h7V14Zm0-6.5V6h7v1.5Z"></path></g>
      <g id="chrome-filled"><path d="M6.875 10.0208C6.875 10.8958 7.17361 11.6389 7.77083 12.25C8.38194 12.8472 9.125 13.1458 10 13.1458C10.875 13.1458 11.6111 12.8472 12.2083 12.25C12.8194 11.6389 13.125 10.8958 13.125 10.0208C13.125 9.14583 12.8194 8.40972 12.2083 7.8125C11.6111 7.20139 10.875 6.89583 10 6.89583C9.125 6.89583 8.38194 7.20139 7.77083 7.8125C7.17361 8.40972 6.875 9.14583 6.875 10.0208ZM10 14.7083C10.1528 14.7083 10.3125 14.7083 10.4792 14.7083C10.6458 14.6944 10.8125 14.6667 10.9792 14.625L8.85417 18.25C6.78472 18.0139 5.06944 17.1111 3.70833 15.5417C2.36111 13.9722 1.6875 12.1319 1.6875 10.0208C1.6875 9.40972 1.75694 8.80556 1.89583 8.20833C2.03472 7.61111 2.24306 7.02083 2.52083 6.4375L5.97917 12.3542C6.38194 13.0903 6.94444 13.6667 7.66667 14.0833C8.38889 14.5 9.16667 14.7083 10 14.7083ZM10 5.33333C8.97222 5.33333 8.05556 5.63889 7.25 6.25C6.44444 6.84722 5.88889 7.625 5.58333 8.58333L3.45833 4.91667C4.22222 3.90278 5.17361 3.11805 6.3125 2.5625C7.46528 1.99305 8.69444 1.70833 10 1.70833C11.375 1.70833 12.6667 2.03472 13.875 2.6875C15.0833 3.32639 16.0694 4.20833 16.8333 5.33333H10ZM17.6875 6.89583C17.9097 7.40972 18.0694 7.93056 18.1667 8.45833C18.2639 8.97222 18.3125 9.49306 18.3125 10.0208C18.3125 12.2569 17.5903 14.1389 16.1458 15.6667C14.7014 17.1806 12.8681 18.0556 10.6458 18.2917L14.0208 12.3542C14.2292 11.9931 14.3889 11.6181 14.5 11.2292C14.625 10.8403 14.6875 10.4375 14.6875 10.0208C14.6875 9.4375 14.5764 8.88194 14.3542 8.35417C14.1458 7.8125 13.8542 7.32639 13.4792 6.89583H17.6875Z"></path></g>
      <g id="computer"><path d="M 1 17 L 1 15.5 L 19 15.5 L 19 17 Z M 3.5 14.5 C 3.085938 14.5 2.734375 14.351562 2.441406 14.058594 C 2.148438 13.765625 2 13.414062 2 13 L 2 4.5 C 2 4.085938 2.148438 3.734375 2.441406 3.441406 C 2.734375 3.148438 3.085938 3 3.5 3 L 16.5 3 C 16.914062 3 17.265625 3.148438 17.558594 3.441406 C 17.851562 3.734375 18 4.085938 18 4.5 L 18 13 C 18 13.414062 17.851562 13.765625 17.558594 14.058594 C 17.265625 14.351562 16.914062 14.5 16.5 14.5 Z M 3.5 13 L 16.5 13 L 16.5 4.5 L 3.5 4.5 Z M 3.5 13 L 3.5 4.5 Z M 3.5 13 "></path></g>
      <g id="credit-card"><path d="M16.4,4 L3.6,4 C2.716,4 2.008,4.7271875 2.008,5.625 L2,15.375 C2,16.2728125 2.716,17 3.6,17 L16.4,17 C17.284,17 18,16.2728125 18,15.375 L18,5.625 C18,4.7271875 17.284,4 16.4,4 Z M16.5,15 L3.5,15 L3.5,10 L16.5,10 L16.5,15 Z M16.5,7 L3.5,7 L3.5,5.5 L16.5,5.5 L16.5,7 Z"></path></g>
      <g id="dashboard"><path d="M3 10.5V4.5C3 4.08333 3.14583 3.72917 3.4375 3.4375C3.74306 3.14583 4.09722 3 4.5 3H9.25V10.5H3ZM10.75 3H15.5C15.9167 3 16.2708 3.14583 16.5625 3.4375C16.8542 3.72917 17 4.08333 17 4.5V8H10.75V3ZM10.75 17V9.5H17V15.5C17 15.9028 16.8542 16.2569 16.5625 16.5625C16.2708 16.8542 15.9167 17 15.5 17H10.75ZM3 12H9.25V17H4.5C4.09722 17 3.74306 16.8542 3.4375 16.5625C3.14583 16.2569 3 15.9028 3 15.5V12ZM4.5 9H7.75V4.5H4.5V9ZM12.25 6.5H15.5V4.5H12.25V6.5ZM12.25 11V15.5H15.5V11H12.25ZM4.5 13.5V15.5H7.75V13.5H4.5Z"></path></g>
      <g id="data"><path d="M0 0h20v20H0z" fill="none" fill-rule="evenodd"></path><path d="M6.5 7v9H4V7h2.5zm5-3v12H9V4h2.5zm5 7v5H14v-5h2.5z"></path></g>
      <g id="data-connectors-system"><path d="M10 4.16667C10.0833 4.16667 10.2333 4.18333 10.3667 4.30833L13.025 6.96667L15.675 9.60833C15.8083 9.74167 15.825 9.9 15.825 10.0167V10.0417C15.825 10.125 15.8 10.2 15.7667 10.2667C15.7583 10.2833 15.75 10.3 15.7417 10.3083C15.725 10.3333 15.7 10.3667 15.675 10.3917L10.4 15.65L10.3583 15.6917C10.2333 15.8167 10.0833 15.8333 10 15.8333C9.91667 15.8333 9.75 15.8167 9.61667 15.675L4.325 10.3833C4.18333 10.2583 4.16667 10.1 4.16667 9.99167C4.16667 9.90833 4.18333 9.75 4.31667 9.60833L6.44167 7.48333L9.60833 4.325C9.75 4.18333 9.91667 4.16667 10 4.16667ZM10 2.5C9.43333 2.5 8.86667 2.71667 8.44167 3.14167L5.275 6.3L3.15 8.425C2.70833 8.85833 2.5 9.43333 2.5 10C2.5 10.5667 2.70833 11.1417 3.14167 11.575L5.26667 13.7L8.43333 16.8583C8.86667 17.2833 9.43333 17.5 10 17.5C10.5667 17.5 11.1333 17.2833 11.5583 16.8583L16.8583 11.575C16.9667 11.4667 17.0583 11.35 17.1417 11.2333C17.1833 11.175 17.2167 11.1083 17.25 11.05C17.4167 10.7333 17.5 10.375 17.5 10.025C17.5 10.0167 17.5 10.0167 17.5 10.0083C17.5083 9.44167 17.2917 8.86667 16.8583 8.43333L11.5583 3.15C11.1333 2.71667 10.5667 2.5 10 2.5Z"></path><path d="M10 11.6667L8.33333 10L10 8.33333L11.6667 10L10 11.6667Z"></path><path d="M10.5917 7.25833C10.9167 6.93333 10.9167 6.40833 10.5917 6.08333C10.2667 5.75833 9.74167 5.75833 9.41667 6.08333C9.09167 6.40833 9.09167 6.93333 9.41667 7.25833C9.73333 7.58333 10.2667 7.58333 10.5917 7.25833Z"></path><path d="M7.25833 10.5917C7.58333 10.2667 7.58333 9.74167 7.25833 9.41667C6.93333 9.09167 6.40833 9.09167 6.08333 9.41667C5.75833 9.74167 5.75833 10.2667 6.08333 10.5917C6.4 10.9167 6.93333 10.9167 7.25833 10.5917Z"></path><path d="M10.5917 13.925C10.9167 13.6 10.9167 13.075 10.5917 12.75C10.2667 12.425 9.74167 12.425 9.41667 12.75C9.09167 13.075 9.09167 13.6 9.41667 13.925C9.73333 14.25 10.2667 14.25 10.5917 13.925Z"></path><path d="M13.925 10.5917C14.25 10.2667 14.25 9.74167 13.925 9.41667C13.6 9.09167 13.075 9.09167 12.75 9.41667C12.425 9.74167 12.425 10.2667 12.75 10.5917C13.0667 10.9167 13.6 10.9167 13.925 10.5917Z"></g>
      <g id="delete"><path d="M6.5 17q-.625 0-1.062-.438Q5 16.125 5 15.5v-10H4V4h4V3h4v1h4v1.5h-1v10q0 .625-.438 1.062Q14.125 17 13.5 17Zm7-11.5h-7v10h7ZM8 14h1.5V7H8Zm2.5 0H12V7h-1.5Zm-4-8.5v10Z"></path></g>
      <g id="desktop-access-disabled" viewBox="0 -960 960 960"><path d="m148-812 68 68h-48v432h378L56-802l51-51 746 747-50 50-185-184h-66v72h72v72H336v-72h72v-72H168q-29.7 0-50.85-21.15Q96-282.3 96-312v-432q0-42 26-55l26-13Zm669 567-67-67h42v-432H318l-72-72h546q29.7 0 50.85 21.15Q864-773.7 864-744v432q0 23-12.5 42T817-245ZM534-528Zm-177 27Z"></path></g>
      <g id="desktop-windows" viewBox="0 -960 960 960"><path d="M336-145v-72h72v-72H168q-29.7 0-50.85-21.15Q96-331.3 96-361v-384q0-29.7 21.15-50.85Q138.3-817 168-817h624q29.7 0 50.85 21.15Q864-774.7 864-745v384q0 29.7-21.15 50.85Q821.7-289 792-289H552v72h72v72H336ZM168-361h624v-384H168v384Zm0 0v-384 384Z"></path></g>
      <g id="difference"><path d="M10.25 9.5H11.75V8H13.25V6.5H11.75V5H10.25V6.5H8.75V8H10.25V9.5ZM8.75 12.5H13.25V11H8.75V12.5ZM6.5 16C6.09722 16 5.74306 15.8542 5.4375 15.5625C5.14583 15.2569 5 14.9028 5 14.5V2.5C5 2.09722 5.14583 1.75 5.4375 1.45833C5.74306 1.15278 6.09722 0.999999 6.5 0.999999H13L17 5V14.5C17 14.9028 16.8472 15.2569 16.5417 15.5625C16.25 15.8542 15.9028 16 15.5 16H6.5ZM6.5 14.5H15.5V5.625L12.375 2.5H6.5V14.5ZM3.5 19C3.09722 19 2.74306 18.8542 2.4375 18.5625C2.14583 18.2569 2 17.9028 2 17.5V6H3.5V17.5H12.5V19H3.5ZM6.5 14.5V2.5V6.5625V14.5Z"></path></g>
      <g id="directions-car" viewBox="0 -960 960 960"><path d="M240-216v48q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9h-48q-10.2 0-17.1-6.9-6.9-6.9-6.9-17.1v-312l78-195q7-21 25.6-33t41.4-12h382q22.8 0 41.4 12 18.6 12 25.6 33l78 195v312q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9h-48q-10.2 0-17.1-6.9-6.9-6.9-6.9-17.1v-48H240Zm1-312h478l-48-120H289l-48 120Zm-25 72v168-168Zm96 132q20 0 34-14t14-34q0-20-14-34t-34-14q-20 0-34 14t-14 34q0 20 14 34t34 14Zm336 0q20 0 34-14t14-34q0-20-14-34t-34-14q-20 0-34 14t-14 34q0 20 14 34t34 14Zm-432 36h528v-168H216v168Z"></path></g>
      <g id="dns"><path fill-rule="evenodd" clip-rule="evenodd" d="M16.6667 2.5H3.33333C2.875 2.5 2.5 2.875 2.5 3.33333V9.16667C2.5 9.625 2.875 10 3.33333 10H16.6667C17.125 10 17.5 9.625 17.5 9.16667V3.33333C17.5 2.875 17.125 2.5 16.6667 2.5ZM7.5 6.25C7.5 6.94036 6.94036 7.5 6.25 7.5C5.55964 7.5 5 6.94036 5 6.25C5 5.55964 5.55964 5 6.25 5C6.94036 5 7.5 5.55964 7.5 6.25ZM7.5 14.5833C7.5 15.2737 6.94036 15.8333 6.25 15.8333C5.55964 15.8333 5 15.2737 5 14.5833C5 13.893 5.55964 13.3333 6.25 13.3333C6.94036 13.3333 7.5 13.893 7.5 14.5833ZM4.16667 8.33333H15.8333V4.16667H4.16667V8.33333ZM16.6667 10.8333H3.33333C2.875 10.8333 2.5 11.2083 2.5 11.6667V17.5C2.5 17.9583 2.875 18.3333 3.33333 18.3333H16.6667C17.125 18.3333 17.5 17.9583 17.5 17.5V11.6667C17.5 11.2083 17.125 10.8333 16.6667 10.8333ZM4.16667 16.6667H15.8333V12.5H4.16667V16.6667Z"></path></g>
      <g id="download"><path d="M 10 13.292969 L 5.230469 8.519531 L 6.644531 7.144531 L 9.019531 9.519531 L 9.019531 2.792969 L 10.980469 2.792969 L 10.980469 9.519531 L 13.355469 7.144531 L 14.769531 8.519531 Z M 4.769531 17.1875 C 4.226562 17.1875 3.765625 16.996094 3.386719 16.613281 C 3.003906 16.234375 2.8125 15.773438 2.8125 15.230469 L 2.8125 12.25 L 4.769531 12.25 L 4.769531 15.230469 L 15.230469 15.230469 L 15.230469 12.25 L 17.207031 12.25 L 17.207031 15.230469 C 17.207031 15.769531 17.015625 16.234375 16.628906 16.613281 C 16.246094 16.996094 15.777344 17.1875 15.230469 17.1875 Z M 4.769531 17.1875"></path></g>
      <g id="e911-emergency"><path d="M 4.5 16 L 4.5 14.5 L 6 14.5 L 7.4375 9.589844 C 7.535156 9.265625 7.714844 9.003906 7.980469 8.800781 C 8.242188 8.601562 8.539062 8.5 8.867188 8.5 L 11.132812 8.5 C 11.460938 8.5 11.757812 8.601562 12.019531 8.800781 C 12.285156 9.003906 12.464844 9.265625 12.5625 9.589844 L 14 14.5 L 15.5 14.5 L 15.5 16 Z M 7.5625 14.5 L 12.4375 14.5 L 11.125 10 L 8.875 10 Z M 9.25 7 L 9.25 3 L 10.75 3 L 10.75 7 Z M 13.707031 8.832031 L 12.644531 7.792969 L 15.480469 4.957031 L 16.542969 6.019531 Z M 14.5 12.25 L 14.5 10.75 L 18.5 10.75 L 18.5 12.25 Z M 6.292969 8.855469 L 3.457031 6.019531 L 4.519531 4.957031 L 7.332031 7.792969 Z M 1.5 12.25 L 1.5 10.75 L 5.5 10.75 L 5.5 12.25 Z M 10 14.5 Z M 10 14.5 "></path></g>
      <g id="edit-square"><path d="M 4.167969 17.5 C 3.707031 17.5 3.316406 17.335938 2.988281 17.011719 C 2.664062 16.683594 2.5 16.292969 2.5 15.832031 L 2.5 4.167969 C 2.5 3.707031 2.664062 3.316406 2.988281 2.988281 C 3.316406 2.664062 3.707031 2.5 4.167969 2.5 L 11.605469 2.5 L 9.9375 4.167969 L 4.167969 4.167969 L 4.167969 15.832031 L 15.832031 15.832031 L 15.832031 10.042969 L 17.5 8.375 L 17.5 15.832031 C 17.5 16.292969 17.335938 16.683594 17.011719 17.011719 C 16.683594 17.335938 16.292969 17.5 15.832031 17.5 Z M 10 10 Z M 7.5 12.5 L 7.5 8.957031 L 15.144531 1.3125 C 15.3125 1.144531 15.5 1.019531 15.707031 0.9375 C 15.917969 0.855469 16.125 0.8125 16.332031 0.8125 C 16.554688 0.8125 16.765625 0.855469 16.96875 0.9375 C 17.171875 1.019531 17.355469 1.144531 17.519531 1.3125 L 18.6875 2.5 C 18.839844 2.667969 18.957031 2.851562 19.042969 3.050781 C 19.125 3.253906 19.167969 3.457031 19.167969 3.667969 C 19.167969 3.875 19.128906 4.078125 19.050781 4.28125 C 18.976562 4.484375 18.855469 4.667969 18.6875 4.832031 L 11.042969 12.5 Z M 17.519531 3.667969 L 16.355469 2.5 Z M 9.167969 10.832031 L 10.332031 10.832031 L 15.167969 6 L 14.582031 5.417969 L 13.980469 4.832031 L 9.167969 9.644531 Z M 14.582031 5.417969 L 13.980469 4.832031 L 14.582031 5.417969 L 15.167969 6 Z M 14.582031 5.417969 "></path></g>
      <g id="fact-check" viewBox="0 -960 960 960"><path d="M168-144q-29.7 0-50.85-21.15Q96-186.3 96-216v-528q0-29.7 21.15-50.85Q138.3-816 168-816h624q29.7 0 50.85 21.15Q864-773.7 864-744v528q0 29.7-21.15 50.85Q821.7-144 792-144H168Zm0-72h624v-528H168v528Zm43-71h192v-72H211v72Zm371-73 170-170-51-51-119 119-51-51-51 51 102 102Zm-371-84h192v-72H211v72Zm0-156h192v-72H211v72Zm-43 384v-528 528Z"></path></g>
      <g id="file-save"><path d="M15.25 17.5L18.25 14.5L17.1875 13.4375L16 14.625V11.5H14.5V14.625L13.3125 13.4375L12.25 14.5L15.25 17.5ZM12.25 20V18.5H18.25V20H12.25ZM5.5 17C5.09722 17 4.74306 16.8542 4.4375 16.5625C4.14583 16.2569 4 15.9028 4 15.5V3.5C4 3.09722 4.14583 2.75 4.4375 2.45833C4.74306 2.15278 5.09722 2 5.5 2H12L16 6V10H14.5V7H11V3.5H5.5V15.5H11V17H5.5ZM5.5 15.5V9.41667V7.45833V3.5V15.5Z"></path></g>
      <g id="filter-list"><path d="M8 14.5V13h4v1.5Zm-3-3.75v-1.5h10v1.5ZM3 7V5.5h14V7Z"></path></g>
      <g id="flash-on"><path d="M5.83337 1.66666V10.8333H8.33337V18.3333L14.1667 8.33332H10.8334L13.3334 1.66666H5.83337Z"></path></g>
      <g id="front-hand"><path d="M 10 10 L 10 1.75 C 10 1.539062 10.070312 1.359375 10.214844 1.214844 C 10.355469 1.070312 10.535156 1 10.746094 1 C 10.957031 1 11.136719 1.070312 11.28125 1.214844 C 11.425781 1.359375 11.5 1.539062 11.5 1.75 L 11.5 10 Z M 7 10 L 7 2.75 C 7 2.539062 7.070312 2.359375 7.214844 2.214844 C 7.355469 2.070312 7.535156 2 7.746094 2 C 7.957031 2 8.136719 2.070312 8.28125 2.214844 C 8.425781 2.359375 8.5 2.539062 8.5 2.75 L 8.5 10 Z M 10.503906 19 C 8.695312 19 7.160156 18.367188 5.894531 17.105469 C 4.632812 15.84375 4 14.308594 4 12.5 L 4 4.75 C 4 4.539062 4.070312 4.359375 4.214844 4.214844 C 4.355469 4.070312 4.535156 4 4.746094 4 C 4.957031 4 5.136719 4.070312 5.28125 4.214844 C 5.425781 4.359375 5.5 4.539062 5.5 4.75 L 5.5 12.5 C 5.5 13.890625 5.984375 15.070312 6.957031 16.042969 C 7.929688 17.015625 9.109375 17.5 10.5 17.5 C 11.890625 17.5 13.070312 17.015625 14.042969 16.042969 C 15.015625 15.070312 15.5 13.890625 15.5 12.5 L 15.5 9.5 C 15.222656 9.5 14.984375 9.597656 14.792969 9.789062 C 14.597656 9.980469 14.5 10.214844 14.5 10.5 L 14.5 13.75 L 11.75 13.75 C 11.269531 13.75 10.855469 13.921875 10.515625 14.265625 C 10.171875 14.605469 10 15.019531 10 15.5 L 10 16 L 8.5 16 L 8.5 15.5 C 8.5 14.597656 8.816406 13.828125 9.449219 13.199219 C 10.078125 12.566406 10.847656 12.25 11.75 12.25 L 13 12.25 L 13 3.75 C 13 3.539062 13.070312 3.359375 13.214844 3.214844 C 13.355469 3.070312 13.535156 3 13.746094 3 C 13.957031 3 14.136719 3.070312 14.28125 3.214844 C 14.425781 3.359375 14.5 3.539062 14.5 3.75 L 14.5 8.207031 C 14.652344 8.140625 14.816406 8.085938 14.988281 8.050781 C 15.164062 8.015625 15.332031 8 15.5 8 L 17 8 L 17 12.5 C 17 14.308594 16.371094 15.84375 15.109375 17.105469 C 13.847656 18.367188 12.3125 19 10.503906 19 Z M 11.25 12.75 Z M 11.25 12.75 "></path></g>
      <g id="gavel" viewBox="0 -960 960 960"><path d="M160-120v-80h480v80H160Zm226-194L160-540l84-86 228 226-86 86Zm254-254L414-796l86-84 226 226-86 86Zm184 408L302-682l56-56 522 522-56 56Z"></path></g>
      <g id="googleg"><path d="M16.58 8H9v2.75h4.47c-.24 1.2-1.42 3.27-4.47 3.27-2.72 0-4.93-2.25-4.93-5.02S6.28 3.98 9 3.98c1.54 0 2.57.66 3.17 1.22l2.19-2.12C12.97 1.79 11.16 1 9 1 4.58 1 1 4.58 1 9s3.58 8 8 8c4.62 0 7.68-3.25 7.68-7.82 0-.46-.04-.83-.1-1.18z"></path></g>
      <g id="gshield"><path d="M 10.089844 13.9375 C 11.410156 13.9375 12.46875 13.519531 13.265625 12.6875 C 14.058594 11.855469 14.457031 10.785156 14.457031 9.46875 C 14.457031 9.296875 14.449219 9.136719 14.425781 8.988281 C 14.40625 8.84375 14.378906 8.703125 14.351562 8.5625 L 10.082031 8.5625 L 10.082031 10.105469 L 12.75 10.105469 C 12.707031 10.546875 12.484375 11.027344 12.074219 11.542969 C 11.664062 12.054688 11 12.3125 10.085938 12.3125 C 9.277344 12.3125 8.601562 12.023438 8.050781 11.445312 C 7.503906 10.871094 7.230469 10.179688 7.230469 9.375 C 7.230469 8.570312 7.503906 7.882812 8.054688 7.3125 C 8.601562 6.742188 9.277344 6.457031 10.074219 6.457031 C 10.523438 6.457031 10.90625 6.535156 11.21875 6.6875 C 11.53125 6.839844 11.773438 7 11.945312 7.167969 L 13.144531 6.003906 C 12.738281 5.644531 12.28125 5.359375 11.777344 5.148438 C 11.273438 4.9375 10.707031 4.832031 10.082031 4.832031 C 8.8125 4.832031 7.738281 5.273438 6.859375 6.15625 C 5.980469 7.039062 5.542969 8.109375 5.542969 9.375 C 5.542969 10.640625 5.984375 11.714844 6.863281 12.605469 C 7.746094 13.492188 8.820312 13.9375 10.089844 13.9375 Z M 10 18.75 C 9.882812 18.75 9.773438 18.738281 9.667969 18.71875 C 9.5625 18.699219 9.464844 18.667969 9.375 18.625 C 7.375 17.972656 5.78125 16.738281 4.59375 14.925781 C 3.40625 13.109375 2.8125 11.171875 2.8125 9.101562 L 2.8125 5.167969 C 2.8125 4.746094 2.925781 4.363281 3.152344 4.015625 C 3.382812 3.671875 3.691406 3.429688 4.082031 3.292969 L 9.3125 1.332031 C 9.535156 1.25 9.765625 1.207031 10 1.207031 C 10.234375 1.207031 10.464844 1.25 10.6875 1.332031 L 15.917969 3.292969 C 16.308594 3.429688 16.621094 3.671875 16.855469 4.015625 C 17.089844 4.363281 17.207031 4.746094 17.207031 5.167969 L 17.207031 9.101562 C 17.207031 11.171875 16.609375 13.109375 15.417969 14.925781 C 14.222656 16.738281 12.625 17.972656 10.625 18.625 C 10.535156 18.667969 10.4375 18.699219 10.332031 18.71875 C 10.226562 18.738281 10.117188 18.75 10 18.75 Z M 10 16.855469 C 11.527344 16.257812 12.78125 15.257812 13.761719 13.855469 C 14.738281 12.453125 15.230469 10.871094 15.230469 9.109375 L 15.230469 5.167969 L 10 3.1875 L 4.769531 5.175781 L 4.769531 9.101562 C 4.769531 10.867188 5.261719 12.453125 6.238281 13.855469 C 7.21875 15.257812 8.472656 16.257812 10 16.855469 Z M 10 10.019531 Z M 10 10.019531"></path></g>
      <g id="history"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.33341 5.00832V3.33332H1.66675V8.33332H6.66675V6.66666H4.24175C5.39175 4.67499 7.53341 3.33332 10.0001 3.33332C13.6834 3.33332 16.6667 6.31666 16.6667 9.99999C16.6667 13.6833 13.6834 16.6667 10.0001 16.6667C6.31675 16.6667 3.33341 13.6833 3.33341 9.99999H1.66675C1.66675 14.6 5.40008 18.3333 10.0084 18.3333C14.6084 18.3333 18.3334 14.6 18.3334 9.99999C18.3334 5.39999 14.6084 1.66666 10.0084 1.66666C7.27508 1.66666 4.85841 2.98332 3.33341 5.00832ZM10.8334 4.99999V9.99999L14.3584 12.45L13.3084 13.7417L9.16675 10.8333V4.99999H10.8334Z"></path></g>
      <g id="home" viewBox="0 -960 960 960"><path d="M264-216h96v-240h240v240h96v-348L480-726 264-564v348Zm-72 72v-456l288-216 288 216v456H528v-240h-96v240H192Zm288-327Z"></path></g>
      <g id="hourglass" viewBox="0 -960 960 960"><path d="M324-168h312v-120q0-65-45.5-110.5T480-444q-65 0-110.5 45.5T324-288v120Zm156-348q65 0 110.5-45.5T636-672v-120H324v120q0 65 45.5 110.5T480-516ZM192-96v-72h60v-120q0-59 28-109.5t78-82.5q-49-32-77.5-82.5T252-672v-120h-60v-72h576v72h-60v120q0 59-28.5 109.5T602-480q50 32 78 82.5T708-288v120h60v72H192Zm288-72Zm0-624Z"></path></g>
      <g id="id-card" viewBox="0 -960 960 960"><path d="M560-440h200v-80H560v80Zm0-120h200v-80H560v80ZM200-320h320v-22q0-45-44-71.5T360-440q-72 0-116 26.5T200-342v22Zm160-160q33 0 56.5-23.5T440-560q0-33-23.5-56.5T360-640q-33 0-56.5 23.5T280-560q0 33 23.5 56.5T360-480ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z"></path></g>
      <g id="iban" viewBox="0 0 20 20"><path d="M1.20431 14.4502V15.9036H9.66906C9.44858 15.177 9.38637 14.4502 9.38637 14.4502H1.20431ZM4.83221 7.80922H2.84798V13.0141H4.83221V7.80922ZM13.199 7.80922H11.1811V10.2349C11.7574 9.7334 12.4427 9.35439 13.199 9.13836V7.80922ZM7.96842 1.66675L7.99158 1.67876L8.01499 1.66675H7.96842ZM14.8257 5.21445L7.99158 1.67876L1.15771 5.21445V6.66598H14.8257V5.21445ZM4.45224 5.12221L7.9684 3.44066H8.01497L11.3167 5.12221H4.45224ZM9.0358 7.80922H7.04038V13.0141H9.0358V7.80922ZM14.662 10.032C12.3572 10.032 10.4819 11.894 10.4819 14.1828C10.4819 16.4715 12.3569 18.3334 14.662 18.3334C16.9671 18.3334 18.8422 16.4715 18.8422 14.1828C18.8422 11.894 16.9668 10.032 14.662 10.032ZM14.5938 14.638C14.2882 14.3344 13.9205 14.1828 13.4914 14.1828H11.6914C11.6914 12.5561 13.0241 11.2325 14.662 11.2325C14.8868 11.2325 15.105 11.2596 15.3156 11.307C15.2638 11.3542 15.2165 11.4066 15.1742 11.4654C15.0929 11.5782 15.0523 11.7091 15.0523 11.8577H14.662C14.4474 11.8577 14.2637 11.9337 14.1106 12.0855C13.9578 12.2371 13.8813 12.4196 13.8813 12.6329V13.4081H15.4424V13.7956C15.4424 14.0087 15.5187 14.1912 15.6715 14.343C15.8245 14.4946 16.0082 14.5706 16.2229 14.5706H17.0036C17.1986 14.5706 17.3679 14.5092 17.511 14.3863C17.5568 14.347 17.5946 14.3033 17.6291 14.2576C17.5886 15.8496 16.2747 17.1329 14.662 17.1329C14.3917 17.1329 14.1307 17.0937 13.8813 17.026V16.1203H15.0521V15.7328C15.0521 15.3063 14.8995 14.9416 14.5938 14.638Z"></path></g>
      <g id="incognito" fill="#5F6368"><circle cx="6.8" cy="12.964" r="1.764"/><path d="M10 0C4.473 0 0 4.473 0 10s4.473 10 10 10 10-4.473 10-10S15.527 0 10 0zM7.619 4.1a.696.696 0 0 1 .881-.419l1.473.492 1.463-.492a.716.716 0 0 1 .883.419l1.608 4.291H6.02l1.6-4.291zm5.517 11.328a2.463 2.463 0 0 1-2.445-2.256c-.682-.436-1.237-.162-1.455-.017a2.45 2.45 0 0 1-2.445 2.263 2.471 2.471 0 0 1-2.464-2.463 2.47 2.47 0 0 1 2.463-2.464c1.165 0 2.138.809 2.391 1.9a1.934 1.934 0 0 1 1.546.009 2.462 2.462 0 0 1 2.392-1.909 2.47 2.47 0 0 1 2.462 2.463 2.435 2.435 0 0 1-2.445 2.474zM16.31 9.8H3.637v-.709H16.31V9.8h-.001z"/><circle cx="13.136" cy="12.964" r="1.764"/></g>
      <g id="incognito-unfilled"><path d="M17.5 9.16667H2.5V10H17.5V9.16667Z"></path><path d="M14.6833 8.33334L12.775 3.25001C12.6167 2.83334 12.1583 2.60834 11.7333 2.75L10 3.33334L8.25833 2.75C7.83333 2.60834 7.375 2.83334 7.21667 3.25001L5.31667 8.33334H14.6833Z"></path><path d="M13.75 10.8333C12.3667 10.8333 11.2167 11.8 10.9167 13.0917C10.2167 12.7917 9.56667 12.875 9.08333 13.0833C8.775 11.7917 7.625 10.8333 6.25 10.8333C4.64167 10.8333 3.33333 12.1417 3.33333 13.75C3.33333 15.3583 4.64167 16.6667 6.25 16.6667C7.78333 16.6667 9.025 15.4833 9.14167 13.9833C9.39167 13.8083 10.05 13.4833 10.8583 14C10.9917 15.4917 12.225 16.6667 13.75 16.6667C15.3583 16.6667 16.6667 15.3583 16.6667 13.75C16.6667 12.1417 15.3583 10.8333 13.75 10.8333ZM6.25 15.8333C5.1 15.8333 4.16667 14.9 4.16667 13.75C4.16667 12.6 5.1 11.6667 6.25 11.6667C7.4 11.6667 8.33333 12.6 8.33333 13.75C8.33333 14.9 7.4 15.8333 6.25 15.8333ZM13.75 15.8333C12.6 15.8333 11.6667 14.9 11.6667 13.75C11.6667 12.6 12.6 11.6667 13.75 11.6667C14.9 11.6667 15.8333 12.6 15.8333 13.75C15.8333 14.9 14.9 15.8333 13.75 15.8333Z"></path></g>
      <g id="interests"><path d="m2 9 4-7 4 7Zm4 8q-1.25 0-2.125-.875T3 14q0-1.25.875-2.125T6 11q1.25 0 2.125.875T9 14q0 1.25-.875 2.125T6 17Zm0-1.5q.625 0 1.062-.438Q7.5 14.625 7.5 14t-.438-1.062Q6.625 12.5 6 12.5t-1.062.438Q4.5 13.375 4.5 14t.438 1.062Q5.375 15.5 6 15.5Zm-1.396-8h2.792L6 5.021ZM11 17v-6h6v6Zm1.5-1.5h3v-3h-3ZM14 9q-1.125-.938-1.854-1.552-.729-.615-1.167-1.083-.437-.469-.614-.865t-.177-.896q0-.875.583-1.489.583-.615 1.5-.615.541 0 .969.219.427.219.76.677.333-.458.771-.677.437-.219.958-.219.917 0 1.5.615.583.614.583 1.489 0 .5-.166.896-.167.396-.604.854-.438.458-1.177 1.073Q15.125 8.042 14 9Zm0-2q1.417-1.188 1.865-1.635.447-.448.447-.782 0-.229-.166-.406Q15.979 4 15.75 4q-.167 0-.312.083-.146.084-.25.209L14 5.396l-1.167-1.104q-.125-.125-.271-.209Q12.417 4 12.25 4q-.229 0-.396.177-.166.177-.166.406 0 .355.468.813Q12.625 5.854 14 7Zm0-1.604Zm-7.979 1Zm0 7.542Zm7.958 0Z"></path></g>
      <g id="keyboard-lock"><path d="M3.332 14.168V5.832Zm.836-3.336h1.664V9.168H4.168Zm2.5 0h1.664V9.168H6.668Zm2.5 0h1.664V9.168H9.168Zm2.5 0h1.664V9.168h-1.664Zm-7.5-2.5h1.664V6.668H4.168Zm2.5 0h1.664V6.668H6.668Zm2.5 0h1.664V6.668H9.168Zm2.5 0h1.664V6.668h-1.664Zm2.5 0h1.664V6.668h-1.664Zm0 2.023c.25-.113.516-.199.8-.261a4.03 4.03 0 0 1 .864-.094v-.832h-1.664Zm-7.5 2.977h5.082c.07-.316.168-.617.293-.895.125-.277.277-.535.457-.769H6.668Zm-3.336 2.5c-.457 0-.848-.16-1.176-.488a1.599 1.599 0 0 1-.488-1.176V5.832c0-.457.16-.848.488-1.176a1.599 1.599 0 0 1 1.176-.488h13.336c.457 0 .848.16 1.176.488.328.328.488.719.488 1.176v5a3.885 3.885 0 0 0-.77-.457 4.616 4.616 0 0 0-.894-.293v-4.25H3.332v8.336h8.336v1.664Zm10.711 2.5a.67.67 0 0 1-.5-.207.68.68 0 0 1-.211-.5v-2.75c0-.195.07-.36.211-.5a.67.67 0 0 1 .5-.207h.125v-.836c0-.457.16-.848.488-1.176a1.599 1.599 0 0 1 1.176-.488c.461 0 .852.16 1.18.488.324.328.488.719.488 1.176v.836h.125c.195 0 .36.066.5.207.14.14.207.305.207.5v2.75c0 .195-.066.36-.207.5a.675.675 0 0 1-.5.207ZM15 14.168h1.668v-.836a.81.81 0 0 0-.242-.594.8.8 0 0 0-.594-.238.807.807 0 0 0-.594.238.807.807 0 0 0-.238.594Zm0 0"></path></g>
      <g id="keyboard-lock-off"><path d="M7.5 10Zm3.48 3.332H6.668v-1.664h4.312Zm-6.812-2.5V9.168h1.664v1.664Zm2.5 0V9.168h1.664v1.664Zm-2.5-2.5V6.668h1.664v1.664Zm7.5 0h1.664V6.668h-1.664Zm2.5 0h1.664V6.668h-1.664Zm0 2.023c.25-.113.516-.199.8-.261a4.03 4.03 0 0 1 .864-.094v-.832h-1.664Zm-.836.477V9.168h-1.664v.125l1.539 1.539Zm-2.5-2.5V6.668H9.168v.125l1.539 1.539Zm6.23 11.086L.582 2.918 1.75 1.75l16.5 16.5ZM10.75 8.355Zm7.582 2.477a3.885 3.885 0 0 0-.77-.457 4.616 4.616 0 0 0-.894-.293v-4.25H8.207L6.543 4.168h10.125c.457 0 .848.16 1.176.488.328.328.488.719.488 1.176Zm-15 5c-.457 0-.848-.16-1.176-.488a1.599 1.599 0 0 1-.488-1.176V5.832c0-.457.16-.848.488-1.176a1.599 1.599 0 0 1 1.176-.488h.836l1.664 1.664h-2.5v8.336h8.336v1.664Zm10.711 2.5a.67.67 0 0 1-.5-.207.68.68 0 0 1-.211-.5v-2.75c0-.195.07-.36.211-.5a.67.67 0 0 1 .5-.207h.125L17.5 17.5v.832Zm4.289-2.375-1.664-1.664v-.961a.81.81 0 0 0-.242-.594.8.8 0 0 0-.594-.238.85.85 0 0 0-.363.082.746.746 0 0 0-.281.23l-.583-.605a1.71 1.71 0 0 1 .551-.395c.215-.097.442-.144.676-.144.461 0 .852.16 1.18.488.324.328.488.719.488 1.176v.836h.125c.195 0 .36.066.5.207.14.14.207.305.207.5Zm0 0"></path></g>
      <g id="lightbulb"><path d="M7.49996 17.5C7.49996 17.9583 7.87496 18.3333 8.33329 18.3333H11.6666C12.125 18.3333 12.5 17.9583 12.5 17.5V16.6667H7.49996V17.5ZM9.99996 1.66667C6.78329 1.66667 4.16663 4.28334 4.16663 7.50001C4.16663 9.48334 5.15829 11.225 6.66663 12.2833V14.1667C6.66663 14.625 7.04163 15 7.49996 15H12.5C12.9583 15 13.3333 14.625 13.3333 14.1667V12.2833C14.8416 11.225 15.8333 9.48334 15.8333 7.50001C15.8333 4.28334 13.2166 1.66667 9.99996 1.66667ZM12.375 10.9167L11.6666 11.4167V13.3333H8.33329V11.4167L7.62496 10.9167C6.49996 10.1333 5.83329 8.85834 5.83329 7.50001C5.83329 5.20001 7.69996 3.33334 9.99996 3.33334C12.3 3.33334 14.1666 5.20001 14.1666 7.50001C14.1666 8.85834 13.5 10.1333 12.375 10.9167Z"></path></g>
      <g id="link"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.16663 12.5H5.83329C4.45829 12.5 3.33329 11.375 3.33329 10C3.33329 8.62501 4.45829 7.50001 5.83329 7.50001H9.16663V5.83334H5.83329C3.53329 5.83334 1.66663 7.70001 1.66663 10C1.66663 12.3 3.53329 14.1667 5.83329 14.1667H9.16663V12.5ZM14.1666 5.83334H10.8333V7.50001H14.1666C15.5416 7.50001 16.6666 8.62501 16.6666 10C16.6666 11.375 15.5416 12.5 14.1666 12.5H10.8333V14.1667H14.1666C16.4666 14.1667 18.3333 12.3 18.3333 10C18.3333 7.70001 16.4666 5.83334 14.1666 5.83334ZM13.3333 9.16668H6.66663V10.8333H13.3333V9.16668Z"></path></g>
      <g id="local-cafe"><path d="M 4 17 L 4 15.5 L 16 15.5 L 16 17 Z M 7 14 C 6.167969 14 5.457031 13.707031 4.875 13.125 C 4.292969 12.542969 4 11.832031 4 11 L 4 3 L 16.5 3 C 16.914062 3 17.265625 3.148438 17.558594 3.441406 C 17.851562 3.734375 18 4.085938 18 4.5 L 18 7.5 C 18 7.914062 17.851562 8.265625 17.558594 8.558594 C 17.265625 8.851562 16.914062 9 16.5 9 L 15 9 L 15 11 C 15 11.832031 14.707031 12.542969 14.125 13.125 C 13.542969 13.707031 12.832031 14 12 14 Z M 7 12.5 L 12 12.5 C 12.414062 12.5 12.765625 12.351562 13.058594 12.058594 C 13.351562 11.765625 13.5 11.414062 13.5 11 L 13.5 4.5 L 5.5 4.5 L 5.5 11 C 5.5 11.414062 5.648438 11.765625 5.941406 12.058594 C 6.234375 12.351562 6.585938 12.5 7 12.5 Z M 15 7.5 L 16.5 7.5 L 16.5 4.5 L 15 4.5 Z M 7 12.5 L 5.5 12.5 L 13.5 12.5 Z M 7 12.5 "></path></g>
      <g id="loyalty-programs" viewBox="0 -960 960 960"><path d="M116.73-511.27Q106-522 101-534.89T96-562v-205q0-29.7 21.15-50.85Q138.3-839 168-839h205q14.22 0 27.11 5Q413-829 424-818l362 362-255 257q-21 21-51 21t-51-21L116.73-511.27ZM168-562l312 312 205-205-312-312H168v205Zm83.79-85q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5ZM735-405q-12.63-12.98-24.82-25.49Q698-443 685-455l66-66q42-42 41.5-101.5T749-725q-42-42-100-41.5T548-725l-68 65-51-51 68-65q65-62 153-62.5t151 63Q864-712 864-623t-63 152l-66 66ZM427-509Zm251-142Z"></path></g>
      <g id="magic"><path d="m11 17-2-2 2-2 2 2-2 2Zm-6-2-5-5 5-5 5 5-5 5Zm7.5-6c0-1.25-.438-2.313-1.313-3.188C10.313 4.938 9.25 4.5 8 4.5c1.25 0 2.313-.438 3.188-1.313C12.062 2.313 12.5 1.25 12.5 0c0 1.25.438 2.313 1.313 3.188C14.687 4.061 15.75 4.5 17 4.5c-1.25 0-2.313.438-3.188 1.313C12.938 6.688 12.5 7.75 12.5 9Z"></path></g>
      <g id="notification-add"><path d="M20,7.69h-2.25V10h-1.5V7.69H14V6.31h2.25V4h1.5v2.31H20V7.69z M13.5,11v3h-7V9c0-1.93,1.57-3.5,3.5-3.5 c0.58,0,1.13,0.14,1.61,0.39l1.1-1.1C12.19,4.47,11.62,4.23,11,4.1V3c0-0.55-0.45-1-1-1S9,2.45,9,3v1.1C6.72,4.56,5,6.58,5,9v5H4 v1.5h12V14h-1v-3H13.5z M10,18c0.83,0,1.5-0.67,1.5-1.5h-3C8.5,17.33,9.17,18,10,18z"></path></g>
      <g id="passkey" viewBox="0 -960 960 960"><path d="M144-192v-96q0-23 12.5-43.5T191-366q55-32 116.36-49T432-432q24 0 48 2.5t48 7.5q-1 46 19 87.5t55 71v71.5H144ZM750-72l-54-54.15V-294q-42-11-69-46t-27-80.19q0-54.61 38.72-93.21 38.72-38.6 93.5-38.6t93.28 38.66Q864-474.69 864-420q0 42.58-24.65 75.69Q814.7-311.19 777-297l45 45-54 54 54 54-72 72ZM432-480q-60 0-102-42t-42-102q0-60 42-102t102-42q60 0 102 42t42 102q0 60-42 102t-102 42Zm299.79 72q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5Z"></path></g>
      <g id="passport" viewBox="0 -960 960 960"><path d="M360-240h240v-48H360v48Zm120.21-120q74.79 0 127.29-52.71t52.5-127.5q0-74.79-52.71-127.29T479.79-720Q405-720 352.5-667.29T300-539.79q0 74.79 52.71 127.29t127.5 52.5Zm-.21-50q-8-8-18.5-34.5T448-516h64q-3 45-13.5 71.5T480-410Zm-61-14q-26-14-45-38t-24-54h50.3q2.14 26.07 6.42 49.54Q411-443 419-424Zm122 0q8-19 12.28-42.46 4.28-23.47 6.42-49.54H610q-5 30-24 54t-45 38ZM350-564q5-30 24-54t45-38q-8 19-12.28 42.46-4.28 23.47-6.42 49.54H350Zm98 0q3-45 13.5-71.5T480-670q8 8 18.5 34.5T512-564h-64Zm111.7 0q-2.14-26.07-6.42-49.54Q549-637 541-656q26 14 45 38t24 54h-50.3ZM192-96v-768h504.28Q726-864 747-842.85T768-792v624q0 29.7-21.15 50.85Q725.7-96 696-96H192Zm72-72h432v-624H264v624Zm0 0v-624 624Z"></path></g>
      <g id="pen-spark"><path d="M5.5 15.5H6.5625L14.375 7.6875L13.3125 6.625L5.5 14.4375V15.5ZM4 17V13.8125L14.375 3.4375C14.5278 3.28472 14.6944 3.17361 14.875 3.10417C15.0556 3.03472 15.2431 3 15.4375 3C15.6319 3 15.8194 3.03472 16 3.10417C16.1806 3.17361 16.3472 3.28472 16.5 3.4375L17.5625 4.5C17.7153 4.65278 17.8264 4.81944 17.8958 5C17.9653 5.18055 18 5.36806 18 5.5625C18 5.75694 17.9653 5.94444 17.8958 6.125C17.8264 6.30555 17.7153 6.47222 17.5625 6.625L7.1875 17H4ZM16.5 5.5625L15.4375 4.5L16.5 5.5625ZM13.8333 7.16667L13.3125 6.625L14.375 7.6875L13.8333 7.16667ZM5.5 10C5.5 8.75 5.0625 7.6875 4.1875 6.8125C3.3125 5.9375 2.25 5.5 1 5.5C2.25 5.5 3.3125 5.0625 4.1875 4.1875C5.0625 3.3125 5.5 2.25 5.5 0.999999C5.5 2.25 5.9375 3.3125 6.8125 4.1875C7.6875 5.0625 8.75 5.5 10 5.5C8.75 5.5 7.6875 5.9375 6.8125 6.8125C5.9375 7.6875 5.5 8.75 5.5 10Z"></path></g>
      <g id="psychiatry"><path d="M9.25 17V10.8125H9.0625C8.27083 10.8125 7.50694 10.6667 6.77083 10.375C6.04861 10.0694 5.40278 9.63889 4.83333 9.08333C4.23611 8.51389 3.77778 7.85417 3.45833 7.10417C3.15278 6.35417 3 5.56944 3 4.75V3H4.75C5.54167 3 6.29861 3.15278 7.02083 3.45833C7.74306 3.75 8.38889 4.17361 8.95833 4.72917C9.36111 5.11805 9.69445 5.55555 9.95833 6.04167C10.2361 6.51389 10.4444 7.01389 10.5833 7.54167C11.1111 6.80556 11.7917 6.24305 12.625 5.85417C13.4583 5.45139 14.3333 5.25 15.25 5.25H17V7C17 7.81944 16.8403 8.60417 16.5208 9.35417C16.2153 10.1042 15.7639 10.7639 15.1667 11.3333C14.6111 11.8194 13.9931 12.1944 13.3125 12.4583C12.6319 12.7222 11.9236 12.8542 11.1875 12.8542H10.75V17H9.25ZM9.25 9.25C9.25 8.61111 9.13889 7.99306 8.91667 7.39583C8.70833 6.78472 8.38194 6.25694 7.9375 5.8125C7.49306 5.36805 6.96528 5.04167 6.35417 4.83333C5.75694 4.61111 5.13889 4.5 4.5 4.5C4.5 5.13889 4.60417 5.76389 4.8125 6.375C5.03472 6.97222 5.36806 7.49306 5.8125 7.9375C6.25694 8.38194 6.77778 8.71528 7.375 8.9375C7.98611 9.14583 8.61111 9.25 9.25 9.25ZM10.75 11.5C11.3889 11.5 12.0069 11.3958 12.6042 11.1875C13.2153 10.9653 13.7431 10.6319 14.1875 10.1875C14.6319 9.74305 14.9583 9.22222 15.1667 8.625C15.3889 8.01389 15.5 7.38889 15.5 6.75C14.8611 6.75 14.2361 6.86111 13.625 7.08333C13.0278 7.29167 12.5069 7.61805 12.0625 8.0625C11.6181 8.50694 11.2847 9.03472 11.0625 9.64583C10.8542 10.2431 10.75 10.8611 10.75 11.5Z"></path></g>
      <g id="quick-reference-all"><path d="M4.5 3.5V7V9.02083C4.5 9.14583 4.5 9.68055 4.5 10.625C4.5 11.5694 4.5 12.6944 4.5 14C4.5 14.4583 4.5 14.9028 4.5 15.3333C4.5 15.75 4.5 16.1389 4.5 16.5V3.5V7V3.5ZM6 12H9.41667C9.54167 11.7222 9.6875 11.4583 9.85417 11.2083C10.0347 10.9583 10.2292 10.7222 10.4375 10.5H6V12ZM6 15H9.10417C9.04861 14.75 9.01389 14.5 9 14.25C8.98611 14 8.99306 13.75 9.02083 13.5H6V15ZM4.5 18C4.08333 18 3.72917 17.8542 3.4375 17.5625C3.14583 17.2708 3 16.9167 3 16.5V3.5C3 3.08333 3.14583 2.72917 3.4375 2.4375C3.72917 2.14583 4.08333 2 4.5 2H11L15 6V9.10417C14.75 9.04861 14.5 9.01389 14.25 9C14 8.98611 13.75 8.99305 13.5 9.02083V7H10V3.5H4.5V16.5H9.66667C9.83333 16.7917 10.0278 17.0694 10.25 17.3333C10.4722 17.5833 10.7222 17.8056 11 18H4.5ZM14 16C14.5556 16 15.0278 15.8056 15.4167 15.4167C15.8056 15.0278 16 14.5556 16 14C16 13.4444 15.8056 12.9722 15.4167 12.5833C15.0278 12.1944 14.5556 12 14 12C13.5556 12 13.1111 12.1667 12.6667 12.5C12.2222 12.8333 12 13.3333 12 14C12 14.5556 12.1944 15.0278 12.5833 15.4167C12.9722 15.8056 13.4444 16 14 16ZM17.9375 19L15.8958 16.9375C15.6181 17.1181 15.3194 17.2569 15 17.3542C14.6806 17.4514 14.3542 17.5 14.0208 17.5C13.0347 17.5 12.2014 17.1597 11.5208 16.4792C10.8403 15.7986 10.5 14.9722 10.5 14C10.5 13.0278 10.8403 12.2014 11.5208 11.5208C12.2014 10.8403 13.0278 10.5 14 10.5C14.9722 10.5 15.7986 10.8403 16.4792 11.5208C17.1597 12.2014 17.5 13.0278 17.5 14C17.5 14.3472 17.4514 14.6806 17.3542 15C17.2569 15.3194 17.1181 15.6181 16.9375 15.8958L19 17.9375L17.9375 19Z"></path></g>
      <g id="router"><path d="M4.5 17c-.414 0-.766-.148-1.059-.441A1.449 1.449 0 0 1 3 15.5v-3.004c0-.414.148-.766.441-1.059A1.439 1.439 0 0 1 4.5 11h8V8H14v3h1.5c.426 0 .785.145 1.09.438.3.292.437.644.41 1.062v3a1.637 1.637 0 0 1-.469 1.05c-.285.302-.629.45-1.031.45Zm0-1.5h11v-3h-11Zm1.746-.75c.211 0 .39-.07.535-.215A.716.716 0 0 0 7 14.004c0-.211-.07-.39-.215-.535a.716.716 0 0 0-.531-.219c-.211 0-.39.07-.535.215a.716.716 0 0 0-.219.531c0 .211.07.39.215.535.14.145.32.219.531.219Zm2.75 0c.211 0 .39-.07.535-.215a.716.716 0 0 0 .219-.531c0-.211-.07-.39-.215-.535a.716.716 0 0 0-.531-.219c-.211 0-.39.07-.535.215a.716.716 0 0 0-.219.531c0 .211.07.39.215.535.14.145.32.219.531.219Zm2.75 0c.211 0 .39-.07.535-.215a.716.716 0 0 0 .219-.531c0-.211-.07-.39-.215-.535a.716.716 0 0 0-.531-.219c-.211 0-.39.07-.535.215a.716.716 0 0 0-.219.531c0 .211.07.39.215.535.14.145.32.219.531.219Zm.36-7.895-1.063-1.062c.289-.277.629-.48 1.02-.606a3.868 3.868 0 0 1 2.374 0c.391.125.731.329 1.02.606l-1.062 1.062a1.042 1.042 0 0 0-.532-.293 2.917 2.917 0 0 0-.613-.062c-.207 0-.414.02-.613.063-.203.042-.38.14-.532.292ZM10 4.75 8.918 3.668a5.052 5.052 0 0 1 1.988-1.273A7.132 7.132 0 0 1 13.25 2c.805 0 1.586.133 2.344.395a5.052 5.052 0 0 1 1.988 1.273L16.5 4.75a4.007 4.007 0 0 0-1.488-.95 5.25 5.25 0 0 0-1.762-.3c-.61 0-1.2.102-1.762.3A4.007 4.007 0 0 0 10 4.75ZM4.5 15.5v-3Zm0 0"></path></g>
      <g id="router-off"><path d="m12.105 6.855-1.062-1.062c.289-.277.629-.48 1.02-.606a3.868 3.868 0 0 1 2.374 0c.391.125.731.329 1.02.606l-1.062 1.062a1.042 1.042 0 0 0-.532-.293 2.917 2.917 0 0 0-.613-.062c-.207 0-.414.02-.613.063-.203.042-.38.14-.532.292ZM10 4.75 8.918 3.668a5.052 5.052 0 0 1 1.988-1.273A7.132 7.132 0 0 1 13.25 2c.805 0 1.586.133 2.344.395a5.052 5.052 0 0 1 1.988 1.273L16.5 4.75a4.007 4.007 0 0 0-1.488-.95 5.25 5.25 0 0 0-1.762-.3c-.61 0-1.2.102-1.762.3A4.007 4.007 0 0 0 10 4.75Zm7 10.125-4.5-4.508V8H14v3h1.5c.426 0 .785.145 1.09.438.3.292.437.644.41 1.062ZM4.5 15.5h8.875l-3-3H4.5ZM16 18.125 14.875 17H4.5c-.414 0-.766-.148-1.059-.441A1.449 1.449 0 0 1 3 15.5v-3.004c0-.414.148-.766.441-1.059A1.439 1.439 0 0 1 4.5 11h4.375l-7-7 1.063-1.063 14.124 14.126ZM6.254 14.75c-.211 0-.39-.07-.535-.215a.716.716 0 0 1-.219-.531c0-.211.07-.39.215-.535a.716.716 0 0 1 .531-.219c.211 0 .39.07.535.215.145.14.219.32.219.531 0 .211-.07.39-.215.535a.716.716 0 0 1-.531.219Zm2.75 0c-.211 0-.39-.07-.535-.215a.716.716 0 0 1-.219-.531c0-.211.07-.39.215-.535a.716.716 0 0 1 .531-.219c.211 0 .39.07.535.215.145.14.219.32.219.531 0 .211-.07.39-.215.535a.716.716 0 0 1-.531.219Zm2.75 0c-.211 0-.39-.07-.535-.215a.716.716 0 0 1-.219-.531c0-.211.07-.39.215-.535a.716.716 0 0 1 .531-.219c.211 0 .39.07.535.215.145.14.219.32.219.531 0 .211-.07.39-.215.535a.716.716 0 0 1-.531.219ZM4.5 15.5v-3Zm0 0"></path></g>
      <g id="rule-folder" viewBox="0 -960 960 960"><path d="m313-305 198-198-57-57-141 142-57-57-56 57 113 113Zm263 0 64-64 64 64 56-56-64-64 64-64-56-56-64 64-64-64-56 56 64 64-64 64 56 56ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"></path></g>
      <g id="person-text" viewBox="0 -960 960 960"><path d="M648-240v-72h216v72H648Zm-48-204v-72h264v72H600Zm-72-204v-72h336v72H528ZM336-480q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM96-240v-63q0-28 14.5-51t38.5-35q43-21 90-32t97-11q50 0 97 11t90 32q24 12 38.5 35t14.5 51v63H96Zm240-120q-53 0-95 12.5T169-312h334q-30-23-72-35.5T336-360Zm0-192q20.4 0 34.2-13.8Q384-579.6 384-600q0-20.4-13.8-34.2Q356.4-648 336-648q-20.4 0-34.2 13.8Q288-620.4 288-600q0 20.4 13.8 34.2Q315.6-552 336-552Zm0-48Zm0 288Z"></path></g>
      <g id="search-spark"><path d="M15.9375 17L10.9583 12.0208C10.5417 12.3264 10.0833 12.5694 9.58333 12.75C9.08333 12.9167 8.55556 13 8 13C6.61111 13 5.43056 12.5139 4.45833 11.5417C3.48611 10.5694 3 9.38889 3 8C3 6.61111 3.48611 5.43055 4.45833 4.45833C5.43056 3.48611 6.61111 3 8 3C8.36111 3 8.70139 3.03472 9.02083 3.10417C9.35417 3.17361 9.67361 3.27778 9.97917 3.41667L8.79167 4.58333C8.66667 4.55555 8.53472 4.53472 8.39583 4.52083C8.27083 4.50694 8.13889 4.5 8 4.5C7.02778 4.5 6.20139 4.84028 5.52083 5.52083C4.84028 6.20139 4.5 7.02778 4.5 8C4.5 8.97222 4.84028 9.79861 5.52083 10.4792C6.20139 11.1597 7.02778 11.5 8 11.5C8.80556 11.5 9.51389 11.2708 10.125 10.8125C10.7361 10.3403 11.1458 9.73611 11.3542 9H12.8958C12.8264 9.36111 12.7153 9.70833 12.5625 10.0417C12.4097 10.3611 12.2292 10.6667 12.0208 10.9583L17 15.9375L15.9375 17ZM14.5 10C14.5 8.75 14.0625 7.6875 13.1875 6.8125C12.3125 5.9375 11.25 5.5 10 5.5C11.25 5.5 12.3125 5.0625 13.1875 4.1875C14.0625 3.3125 14.5 2.25 14.5 0.999999C14.5 2.25 14.9375 3.3125 15.8125 4.1875C16.6875 5.0625 17.75 5.5 19 5.5C17.75 5.5 16.6875 5.9375 15.8125 6.8125C14.9375 7.6875 14.5 8.75 14.5 10Z"></path></g>
      <g id="security"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.183 4.7L10 1.667 16.816 4.7v4.542c0 4.208-2.908 8.133-6.816 9.091-3.909-.958-6.817-4.883-6.817-9.091V4.7zM15.3 9.992H10V3.325L4.7 5.683V10l5.3-.008v6.775c2.816-.875 4.9-3.65 5.3-6.775z"></path></g>
      <g id="shield" viewBox="0 -960 960 960"><path d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z"></path></g>
      <g id="sprint"><path d="M 4.519531 16.5 L 3.480469 15.4375 L 11.417969 7.5 L 9.5 7.5 L 9.5 9 L 8 9 L 8 6 L 12.644531 6 L 16.707031 10.042969 C 17.027344 10.347656 17.378906 10.582031 17.761719 10.75 C 18.140625 10.917969 18.554688 11 19 11 L 19 12.5 C 18.359375 12.5 17.753906 12.378906 17.175781 12.136719 C 16.601562 11.890625 16.089844 11.546875 15.644531 11.105469 L 14 9.5 L 12 11.5 L 13.980469 13.480469 L 8.75 16.5 L 8 15.207031 L 11.519531 13.167969 L 9.707031 11.332031 Z M 3 11 L 3 9.5 L 7 9.5 L 7 11 Z M 1 8.5 L 1 7 L 5 7 L 5 8.5 Z M 16 7 C 15.582031 7 15.230469 6.851562 14.9375 6.558594 C 14.644531 6.261719 14.5 5.910156 14.5 5.496094 C 14.5 5.082031 14.644531 4.730469 14.9375 4.4375 C 15.230469 4.144531 15.582031 4 16 4 C 16.417969 4 16.769531 4.148438 17.0625 4.441406 C 17.355469 4.738281 17.5 5.089844 17.5 5.503906 C 17.5 5.917969 17.355469 6.269531 17.0625 6.5625 C 16.769531 6.855469 16.417969 7 16 7 Z M 3 6 L 3 4.5 L 7 4.5 L 7 6 Z M 3 6 "></path></g>
      <g id="sync-saved-locally"><path d="M 9.105469 11.707031 L 13.832031 7 L 12.644531 5.8125 L 9.105469 9.355469 L 7.332031 7.582031 L 6.167969 8.75 Z M 0.832031 17.5 L 0.832031 15.832031 L 19.167969 15.832031 L 19.167969 17.5 Z M 3.332031 15 C 2.875 15 2.484375 14.835938 2.15625 14.511719 C 1.828125 14.183594 1.667969 13.792969 1.667969 13.332031 L 1.667969 4.167969 C 1.667969 3.707031 1.828125 3.316406 2.15625 2.988281 C 2.484375 2.664062 2.875 2.5 3.332031 2.5 L 16.667969 2.5 C 17.125 2.5 17.515625 2.664062 17.84375 2.988281 C 18.171875 3.316406 18.332031 3.707031 18.332031 4.167969 L 18.332031 13.332031 C 18.332031 13.792969 18.171875 14.183594 17.84375 14.511719 C 17.515625 14.835938 17.125 15 16.667969 15 Z M 3.332031 13.332031 L 16.667969 13.332031 L 16.667969 4.167969 L 3.332031 4.167969 Z M 3.332031 13.332031 L 3.332031 4.167969 Z M 3.332031 13.332031 "></path></g>
      <g id="summarize"><path d="M6.75 7.5C6.95833 7.5 7.13194 7.43055 7.27083 7.29167C7.42361 7.13889 7.5 6.95833 7.5 6.75C7.5 6.54167 7.42361 6.36805 7.27083 6.22917C7.13194 6.07639 6.95833 6 6.75 6C6.54167 6 6.36111 6.07639 6.20833 6.22917C6.06944 6.36805 6 6.54167 6 6.75C6 6.95833 6.06944 7.13889 6.20833 7.29167C6.36111 7.43055 6.54167 7.5 6.75 7.5ZM6.75 10.75C6.95833 10.75 7.13194 10.6806 7.27083 10.5417C7.42361 10.3889 7.5 10.2083 7.5 10C7.5 9.79167 7.42361 9.61806 7.27083 9.47917C7.13194 9.32639 6.95833 9.25 6.75 9.25C6.54167 9.25 6.36111 9.32639 6.20833 9.47917C6.06944 9.61806 6 9.79167 6 10C6 10.2083 6.06944 10.3889 6.20833 10.5417C6.36111 10.6806 6.54167 10.75 6.75 10.75ZM6.75 14C6.95833 14 7.13194 13.9306 7.27083 13.7917C7.42361 13.6389 7.5 13.4583 7.5 13.25C7.5 13.0417 7.42361 12.8681 7.27083 12.7292C7.13194 12.5764 6.95833 12.5 6.75 12.5C6.54167 12.5 6.36111 12.5764 6.20833 12.7292C6.06944 12.8681 6 13.0417 6 13.25C6 13.4583 6.06944 13.6389 6.20833 13.7917C6.36111 13.9306 6.54167 14 6.75 14ZM4.5 17C4.08333 17 3.72917 16.8542 3.4375 16.5625C3.14583 16.2708 3 15.9167 3 15.5V4.5C3 4.08333 3.14583 3.72917 3.4375 3.4375C3.72917 3.14583 4.08333 3 4.5 3H13L17 7V15.5C17 15.9167 16.8542 16.2708 16.5625 16.5625C16.2708 16.8542 15.9167 17 15.5 17H4.5ZM4.5 15.5H15.5V8H12V4.5H4.5V15.5ZM4.5 4.5V7.75V4.5V7.75V15.5V4.5Z"></path></g>
      <g id="tab"><path d="M3.5 14.5H16.5V9H11V5.5H3.5V14.5ZM3.5 16C3.08333 16 2.72917 15.8542 2.4375 15.5625C2.14583 15.2708 2 14.9167 2 14.5V5.5C2 5.08333 2.14583 4.72917 2.4375 4.4375C2.72917 4.14583 3.08333 4 3.5 4H16.5C16.9167 4 17.2708 4.14583 17.5625 4.4375C17.8542 4.72917 18 5.08333 18 5.5V14.5C18 14.9167 17.8542 15.2708 17.5625 15.5625C17.2708 15.8542 16.9167 16 16.5 16H3.5ZM3.5 14.5V5.5V14.5Z"></path></g>
      <g id="text-analysis"><path d="M 2.5 17.5 L 2.5 15.832031 L 12.5 15.832031 L 12.5 17.5 Z M 2.5 13.332031 L 2.5 11.667969 L 17.5 11.667969 L 17.5 13.332031 Z M 2.5 9.167969 L 2.5 7.5 L 11.667969 7.5 L 11.667969 9.167969 Z M 14.582031 10 C 14.582031 8.722656 14.140625 7.640625 13.25 6.75 C 12.359375 5.859375 11.277344 5.417969 10 5.417969 C 11.277344 5.417969 12.359375 4.972656 13.25 4.082031 C 14.140625 3.195312 14.582031 2.109375 14.582031 0.832031 C 14.582031 2.109375 15.027344 3.195312 15.917969 4.082031 C 16.804688 4.972656 17.890625 5.417969 19.167969 5.417969 C 17.890625 5.417969 16.804688 5.859375 15.917969 6.75 C 15.027344 7.640625 14.582031 8.722656 14.582031 10 Z M 14.582031 10 "></path></g>
      <g id="timer"><path d="M7.5 3V1.5H12.5V3H7.5ZM9.25 12H10.75V7H9.25V12ZM10 18C9.02778 18 8.11806 17.8194 7.27083 17.4583C6.42361 17.0833 5.68056 16.5833 5.04167 15.9583C4.41667 15.3194 3.91667 14.5764 3.54167 13.7292C3.18056 12.8819 3 11.9722 3 11C3 10.0278 3.18056 9.11806 3.54167 8.27083C3.91667 7.42361 4.41667 6.6875 5.04167 6.0625C5.68056 5.42361 6.42361 4.92361 7.27083 4.5625C8.11806 4.1875 9.02778 4 10 4C10.8056 4 11.5764 4.13889 12.3125 4.41667C13.0625 4.68055 13.7569 5.05555 14.3958 5.54167L15.4792 4.47917L16.5208 5.52083L15.4583 6.60417C15.9444 7.22917 16.3194 7.91667 16.5833 8.66667C16.8611 9.41667 17 10.1944 17 11C17 11.9722 16.8125 12.8819 16.4375 13.7292C16.0764 14.5764 15.5764 15.3194 14.9375 15.9583C14.3125 16.5833 13.5764 17.0833 12.7292 17.4583C11.8819 17.8194 10.9722 18 10 18ZM10 16.5C11.5278 16.5 12.8264 15.9653 13.8958 14.8958C14.9653 13.8264 15.5 12.5278 15.5 11C15.5 9.47222 14.9653 8.17361 13.8958 7.10417C12.8264 6.03472 11.5278 5.5 10 5.5C8.47222 5.5 7.17361 6.03472 6.10417 7.10417C5.03472 8.17361 4.5 9.47222 4.5 11C4.5 12.5278 5.03472 13.8264 6.10417 14.8958C7.17361 15.9653 8.47222 16.5 10 16.5Z"></path></g>
      <g id="travel" viewBox="0 -960 960 960"><path d="m401-130-95-176-176-95 67-68 145 25 97-96-309-133 85-85 372 69 120-120q21-21 51-21t51 21q21 21 21 50.5T809-708L689-588l69 373-85 85-133-309-96 97 25 145-68 67Z"></path></g>
      <g id="undo"><path d="M11.8335 15.8333H5.8335V14.5833H11.8543C12.8266 14.5833 13.6634 14.2604 14.3647 13.6146C15.0661 12.9687 15.4168 12.1666 15.4168 11.2083C15.4168 10.25 15.0661 9.4479 14.3647 8.80206C13.6634 8.15623 12.8266 7.83331 11.8543 7.83331H5.7085L8.0835 10.2083L7.2085 11.0833L3.3335 7.20831L7.2085 3.33331L8.0835 4.20831L5.7085 6.58331H11.8335C13.1529 6.58331 14.2884 7.02776 15.2397 7.91665C16.1911 8.80554 16.6668 9.90276 16.6668 11.2083C16.6668 12.5139 16.1911 13.6111 15.2397 14.5C14.2884 15.3889 13.1529 15.8333 11.8335 15.8333Z"></path></g>
      <g id="user-attributes-filled" viewBox="0 -960 960 960"><path d="M576-696v-72h288v72H576Zm0 156v-72h288v72H576Zm0 156v-72h288v72H576Zm-240-48q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM96-192v-63q0-28 14.5-51t38.5-35q43-21 90-32t97-11q50 0 97 11t90 32q24 12 38.5 35t14.5 51v63H96Z"></path></g>
      <g id="wallet" viewBox="0 -960 960 960"><path d="M240-192q-60 0-102-42T96-336v-288q0-60 42-102t102-42h480q60 0 102 42t42 102v288q0 60-42 102t-102 42H240Zm0-432h480q19 0 37 5.5t35 14.5v-20q0-30-21-51t-51-21H240q-30 0-51 21t-21 51v20q17-10 35-15t37-5Zm-63 110 430 105q8 2 16 0t15-7l135-112q-11-11-24.5-17.5T720-552H240q-20 0-38 11t-25 27Z"></path></g>
      <g id="warning_outline" viewBox="0 0 24 24"><path d="M12 5.99 19.53 19H4.47L12 5.99M12 2 1 21h22L12 2z"></path><polygon points="13,16 11,16 11,18 13,18"></polygon><polygon points="13,10 11,10 11,15 13,15"></polygon></g>
      <g id="web" viewBox="0 -960 960 960"><path d="M168-192q-29.7 0-50.85-21.16Q96-234.32 96-264.04v-432.24Q96-726 117.15-747T168-768h624q29.7 0 50.85 21.16Q864-725.68 864-695.96v432.24Q864-234 842.85-213T792-192H168Zm0-72h408v-120H168v120Zm480 0h144v-312H648v312ZM168-456h408v-120H168v120Z"></path></g>
      <g id="work" viewBox="0 -960 960 960"><path d="M168-144q-29.7 0-50.85-21.15Q96-186.3 96-216v-432q0-29.7 21.15-50.85Q138.3-720 168-720h168v-72.21Q336-822 357.18-843q21.17-21 50.91-21h144.17Q582-864 603-842.85q21 21.15 21 50.85v72h168q29.7 0 50.85 21.15Q864-677.7 864-648v432q0 29.7-21.15 50.85Q821.7-144 792-144H168Zm0-72h624v-432H168v432Zm240-504h144v-72H408v72ZM168-216v-432 432Z"></path></g>
    </defs>
  </svg>
</cr-iconset>

<!-- NOTE: In the common case that the final icon will be 20x20, export the SVG
     at 20px and place it in the section above. -->
<cr-iconset name="settings" size="24">
  <svg>
    <defs>
      <!-- Location disabled GM3 icon -->
      <g id="location-disabled" viewBox="0 -960 960 960">
        <path d="m784-286-58-58q17-30 25.5-64t8.5-70q0-116-82-198t-198-82q-36 0-70 8.5T346-724l-58-58q35-21 72.5-35t79.5-19v-80h80v80q125 14 214.5 103.5T838-518h80v80h-80q-5 42-19 79.5T784-286ZM440-40v-80q-125-14-214.5-103.5T122-438H42v-80h80q5-42 19-79.5t35-72.5L56-790l56-56 736 736-58 56-118-120q-35 21-72.5 35T520-120v80h-80Zm40-158q36 0 70-8.5t64-25.5L234-612q-17 30-25.5 64t-8.5 70q0 116 82 198t198 82Z"></path>
      </g>

      <!-- Domain verification GM3 icon -->
      <g id="domain-verification" viewBox="0 -960 960 960">
        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm278-58L296-440l58-58 84 84 168-168 58 58-226 226Zm-278 58v-480 480Z"></path>
      </g>

      <!-- Forward GM3 icon -->
      <g id="forward" viewBox="0 -960 960 960">
        <path d="m640-280-57-56 184-184-184-184 57-56 240 240-240 240ZM80-200v-160q0-83 58.5-141.5T280-560h247L383-704l57-56 240 240-240 240-57-56 144-144H280q-50 0-85 35t-35 85v160H80Z"></path>
      </g>

      <!-- Navigation: Accessibility disabled GM3 icon -->
      <g id="accessibility" viewBox="0 -960 960 960">
        <path d="M479.75-696q-34.75 0-59.25-24.75t-24.5-59.5q0-34.75 24.75-59.25t59.5-24.5q34.75 0 59.25 24.75t24.5 59.5q0 34.75-24.75 59.25t-59.5 24.5ZM360-108v-456H144v-72h672v72H600v456h-72l-9-220h-77l-10 220h-72Z"></path>
      </g>

      <!-- Navigation: Assignment disabled GM3 icon -->
      <g id="assignment" viewBox="0 -960 960 960">
        <path d="M288-384q39.6 0 67.8-28.2Q384-440.4 384-480q0-39.6-28.2-67.8Q327.6-576 288-576q-39.6 0-67.8 28.2Q192-519.6 192-480q0 39.6 28.2 67.8Q248.4-384 288-384Zm0 144q-100 0-170-70T48-480q0-100 70-170t170-70q72 0 131 39t89 105h332q29.7 0 50.85 21.15Q912-533.7 912-504v192q0 29.7-21.15 50.85Q869.7-240 840-240H696q-29.7 0-50.85-21.15Q624-282.3 624-312v-72H508q-30 66-89 105t-131 39Zm166-216h242v144h48v-72q0-10.4 6.8-17.2 6.8-6.8 17.2-6.8 10.4 0 17.2 6.8 6.8 6.8 6.8 17.2v72h48v-192H454q-8-63-55.62-103.5Q350.77-648 288-648q-70 0-119 49t-49 119q0 70 49 119t119 49q62.77 0 110.38-40.5Q446-393 454-456Z"></path>
      </g>

      <!-- Navigation: Download GM3 icon -->
      <g id="download" viewBox="0 -960 960 960">
        <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z"></path>
      </g>

      <!-- Navigation: Extension GM3 icon -->
      <g id="extension" viewBox="0 -960 960 960">
        <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-168q40-2 68-29.5t28-66.5q0-39-28-66.5T144-576v-168q0-29.7 21.15-50.85Q186.3-816 216-816h168q0-40 27.77-68 27.78-28 68-28Q520-912 548-884.16q28 27.84 28 68.16h168q29.7 0 50.85 21.15Q816-773.7 816-744v168q40 0 68 27.77 28 27.78 28 68Q912-440 884.16-412q-27.84 28-68.16 28v168q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528H216v112q45 20 70.5 61.5T312-480q0 50.21-25.5 91.6Q261-347 216-328v112Zm264-264Z"></path>
      </g>

      <!-- Navigation: Palette GM3 icon -->
      <g id="palette" viewBox="0 -960 960 960">
        <path d="M480-96q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30.5-149.5t84-122Q264-804 335.5-834T488-864q78 0 146.5 27T754-763q51 47 80.5 110T864-518q0 96-67 163t-163 67h-68q-8 0-14 5t-6 13q0 15 15 25t15 53q0 37-27 66.5T480-96Zm0-384Zm-216 36q25 0 42.5-17.5T324-504q0-25-17.5-42.5T264-564q-25 0-42.5 17.5T204-504q0 25 17.5 42.5T264-444Zm120-144q25 0 42.5-17.5T444-648q0-25-17.5-42.5T384-708q-25 0-42.5 17.5T324-648q0 25 17.5 42.5T384-588Zm192 0q25 0 42.5-17.5T636-648q0-25-17.5-42.5T576-708q-25 0-42.5 17.5T516-648q0 25 17.5 42.5T576-588Zm120 144q25 0 42.5-17.5T756-504q0-25-17.5-42.5T696-564q-25 0-42.5 17.5T636-504q0 25 17.5 42.5T696-444ZM480-168q11 0 17.5-8.5T504-192q0-16-15-28t-15-50q0-38 26.5-64t64.5-26h69q66 0 112-46t46-112q0-115-88.5-194.5T488-792q-134 0-227 91t-93 221q0 130 91 221t221 91Z"></path>
      </g>

      <!-- Navigation: Language GM3 icon -->
      <g id="navigation-language" viewBox="0 -960 960 960">
        <path d="m488-96 171-456h82L912-96h-79l-41-117H608L567-96h-79ZM169-216l-50-51 192-190q-36-38-67-79t-54-89h82q18 32 36 54.5t52 60.5q38-42 70-87.5t52-98.5H48v-72h276v-96h72v96h276v72H558q-21 69-61 127.5T409-457l91 90-28 74-112-112-191 189Zm463-63h136l-66-189-70 189Z"></path>
      </g>

      <!-- Navigation: Performance GM3 icon -->
      <g id="navigation-performance" viewBox="0 -960 960 960">
        <path d="M429-358q23 22 57 20.5t50-25.5l208-309-309.16 208.26Q410-447 408-413.5t21 55.5Zm52-410q60 0 108 15.5t87 38.5l-69 45q-28-13-58.5-20t-67.5-7q-130.09 0-221.55 93.5Q168-509 168-384q0 38 5.5 62.5T191-264h577q13-33 18.5-60.5T792-384q0-42-11.5-84T747-545l43-65q35 48 54.5 106T864-386q0 51-8.5 89T828-227q-10 17-25.5 26t-34.5 9H192q-19 0-34.5-9T132-227q-19-32-27.5-70T96-386q0-79.72 30.5-149.36Q157-605 209-656.5T331.44-738q70.44-30 149.56-30Zm-1 279Z"></path>
      </g>

      <!-- Navigation: Person GM3 icon -->
      <g id="person" viewBox="0 -960 960 960">
        <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z"></path>
      </g>

      <!-- Navigation: Power settings GM3 icon -->
      <g id="power-settings" viewBox="0 -960 960 960">
        <path d="M444-432v-384h72v384h-72Zm36 288q-70 0-130.92-26.51-60.92-26.5-106.49-72.08-45.58-45.57-72.08-106.49Q144-410 144-480.16 144-556 176.5-624T268-740l51 51q-49 38-76 92.5T216-480q0 110 77.25 187t186.53 77Q590-216 667-293t77-187q0-61.84-26.5-116.92T641-689l51-51q60 48 92 115.8T816-480q0 70-26.6 130.92-26.6 60.92-71.87 106.49-45.26 45.58-106.4 72.08Q550-144 480-144Z"></path>
      </g>

      <!-- Navigation: Restore GM3 icon -->
      <g id="restore" viewBox="0 -960 960 960">
        <path d="M444-144q-107-14-179.5-94.5T192-430q0-61 23-113.5t63-91.5l51 51q-30 29-47.5 69T264-430q0 81 51.5 140T444-217v73Zm72 0v-73q77-13 128.5-72.5T696-430q0-90-63-153t-153-63h-7l46 46-51 50-132-132 132-132 51 51-45 45h6q120 0 204 84t84 204q0 111-72.5 192T516-144Z"></path>
      </g>

      <!-- Navigation: Search GM3 icon -->
      <g id="search" viewBox="0 -960 960 960">
        <path d="M765-144 526-383q-30 22-65.79 34.5-35.79 12.5-76.18 12.5Q284-336 214-406t-70-170q0-100 70-170t170-70q100 0 170 70t70 170.03q0 40.39-12.5 76.18Q599-464 577-434l239 239-51 51ZM384-408q70 0 119-49t49-119q0-70-49-119t-119-49q-70 0-119 49t-49 119q0 70 49 119t119 49Z"></path>
      </g>

      <!-- Navigation: Security GM3 icon -->
      <g id="security" viewBox="0 -960 960 960">
        <path d="M480-96q-135-33-223.5-153T168-515v-229l312-120 312 120v229q0 146-88.5 266T480-96Zm0-75q97-30 161.5-115.5T717-480H480v-307l-240 92v180q0 9 1 17.5t2 17.5h237v309Z"></path>
      </g>


      <!-- Navigation: System GM3 icon -->
      <g id="system" viewBox="0 -960 960 960">
        <path d="M666-163 475-354q-20 8-43.5 12.5T384-337q-99 0-169.5-70T144-576q0-37.78 9.5-71.89T182-711l144 144 70-70-144-144q29-17 62.5-26t69.5-9q100 0 170 71t70 170.19q0 22.81-4.5 42.31Q615-513 607-493l195 194q14 14.35 14 34.67Q816-244 802-230l-68 67q-14.09 14-34.04 14Q680-149 666-163Zm34-68 35-34-215-213q20-24 26-52.5t6-44.5q0-66.85-47.5-116.42Q457-741 390-744l82 81q11 11.18 11 26.09t-11.29 26.12L351.29-491.21Q340-480 325.82-480T301-491l-85-85q0 69 49.5 118T384-409q17 0 47-7t56-28l213 213ZM476-488Z"></path>
      </g>

      <!-- Navigation: Web GM3 icon -->
      <g id="web" viewBox="0 -960 960 960">
        <path d="M168-192q-29.7 0-50.85-21.16Q96-234.32 96-264.04v-432.24Q96-726 117.15-747T168-768h624q29.7 0 50.85 21.16Q864-725.68 864-695.96v432.24Q864-234 842.85-213T792-192H168Zm0-72h624v-360H168v360Z"></path>
      </g>


      <!-- Google Symbols: Print -->
      <g id="printer" viewBox="0 -960 960 960">
        <path d="M648-624v-120H312v120h-72v-192h480v192h-72Zm-480 72h625-625Zm539.789 96Q723-456 733.5-466.289q10.5-10.29 10.5-25.5Q744-507 733.711-517.5q-10.29-10.5-25.5-10.5Q693-528 682.5-517.711q-10.5 10.29-10.5 25.5Q672-477 682.289-466.5q10.29 10.5 25.5 10.5ZM648-216v-144H312v144h336Zm72 72H240v-144H96v-240q0-40 28-68t68-28h576q40 0 68 28t28 68v240H720v144Zm73-216v-153.672Q793-530 781-541t-28-11H206q-16.15 0-27.075 11.04T168-513.6V-360h72v-72h480v72h73Z"/>
      </g>

      <!-- Google Symbols: Print Disabled -->
      <g id="printer-off" viewBox="0 -960 960 960">
        <path d="m768-90-54-54H240v-144H96v-240q0-40 28-68t68-28h42L90-768l51-51 678 678-51 51ZM312-216h330L498-360H312v144Zm462-72-72-72h90v-153.672Q792-530 781.075-541T754-552H510l-72-72h330q40 0 68 28t28 68v240h-90Zm-606-72h72v-72h186L306-552h-99q-16 0-27.5 11.04T168-513.6V-360Zm480-264v-120H318l-72-72h474v192h-72Zm59.789 168Q723-456 733.5-466.289q10.5-10.29 10.5-25.5Q744-507 733.711-517.5q-10.29-10.5-25.5-10.5Q693-528 682.5-517.711q-10.5 10.29-10.5 25.5Q672-477 682.289-466.5q10.29 10.5 25.5 10.5ZM207-552h99-138 39Zm547 0h39-283 244Z"/>
      </g>

      <!-- Cookies Settings SVG -->
      <g id="block"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"></path></g>

      <!-- Picture-in-picture SVG -->
      <g id="picture-in-picture"><path d="M4 20c-.55 0-1.02-.195-1.414-.586A1.935 1.935 0 0 1 2 18V6c0-.55.195-1.02.586-1.414C2.98 4.196 3.449 4 4 4h16c.55 0 1.02.195 1.414.586.39.394.586.863.586 1.414v12c0 .55-.195 1.02-.586 1.414-.394.39-.863.586-1.414.586Zm0-2h16V6H4Zm0 0V6Zm7-5h8V7h-8Zm2-2V9h4v2Zm0 0"></path></g>
      <g id="picture-in-picture-off"><path d="M15.852 13H19V7h-8v1.148l2 2V9h4v2h-3.148Zm5.921 5.926L20 17.148V6H8.852l-2-2H20c.55 0 1.02.195 1.414.586.39.394.586.863.586 1.414v12c0 .168-.016.328-.05.488-.032.157-.09.305-.177.438Zm-12.199-6.5Zm4.852-.852Zm6.023 11.727L17.15 20H4c-.55 0-1.02-.195-1.414-.586A1.935 1.935 0 0 1 2 18V6c0-.55.195-1.02.586-1.414C2.98 4.196 3.449 4 4 4l2 2H4v12h11.148L.648 3.5l1.426-1.426 19.801 19.801Zm0 0"></path></g>

      <!-- Touchpad-Mouse SVG -->
      <g id="touchpad-mouse"><path d="M16.5 20c.965 0 1.793-.34 2.477-1.023A3.377 3.377 0 0 0 20 16.5V15h-7v1.5c0 .965.34 1.793 1.023 2.477A3.377 3.377 0 0 0 16.5 20Zm-3.477-7H15.5v-2.852a3.438 3.438 0 0 0-1.637 1.051 3.392 3.392 0 0 0-.84 1.801Zm4.477 0h2.477a3.392 3.392 0 0 0-.84-1.8 3.438 3.438 0 0 0-1.637-1.052Zm-1 9c-1.535 0-2.832-.535-3.898-1.602C11.535 19.332 11 18.035 11 16.5v-3c0-1.535.535-2.832 1.602-3.898C13.668 8.535 14.965 8 16.5 8c1.535 0 2.832.535 3.898 1.602C21.465 10.668 22 11.965 22 13.5v3c0 1.535-.535 2.832-1.602 3.898C19.332 21.465 18.035 22 16.5 22ZM4 18V6Zm0 2c-.55 0-1.02-.195-1.414-.586A1.935 1.935 0 0 1 2 18V6c0-.55.195-1.02.586-1.414C2.98 4.196 3.449 4 4 4h16c.55 0 1.02.195 1.414.586.39.394.586.863.586 1.414v2.398a6.878 6.878 0 0 0-.926-.859A6.791 6.791 0 0 0 20 6.852V6H4v12h5.148c.086.352.18.691.29 1.023.109.336.246.66.414.977Zm0 0"></path></g>
      <g id="touchpad-mouse-off"><path d="M16.5 15.023Zm0 0Zm3.977 8.278L.676 3.5l1.426-1.426 19.796 19.801ZM16.5 15.023Zm0 0Zm0 6.977c-1.535 0-2.832-.535-3.898-1.602C11.535 19.332 11 18.035 11 16.5v-3c0-.383.04-.746.113-1.086.075-.344.18-.68.313-1.016L15.023 15H13v1.5c0 .965.34 1.793 1.023 2.477A3.377 3.377 0 0 0 16.5 20a3.4 3.4 0 0 0 1.363-.273 3.312 3.312 0 0 0 1.114-.778l1.421 1.426c-.5.5-1.082.895-1.75 1.188A5.27 5.27 0 0 1 16.5 22Zm5.05-3.324-1.6-1.602c.015-.097.03-.195.038-.285.008-.094.012-.187.012-.289V15h-2.125L15.5 12.625v-2.477a3.518 3.518 0 0 0-.813.364 3.38 3.38 0 0 0-.71.59L12.55 9.676a5.602 5.602 0 0 1 1.761-1.227C14.989 8.15 15.716 8 16.5 8c1.535 0 2.832.535 3.898 1.602C21.465 10.668 22 11.965 22 13.5v3c0 .383-.043.758-.125 1.125a6.991 6.991 0 0 1-.324 1.05ZM17.5 13h2.477a3.392 3.392 0 0 0-.84-1.8 3.438 3.438 0 0 0-1.637-1.052ZM9.926 9.898ZM4 20c-.55 0-1.02-.195-1.414-.586A1.935 1.935 0 0 1 2 18V6c0-.55.195-1.02.586-1.414C2.98 4.196 3.449 4 4 4h.023l2 2H4v12h5.148c.086.352.18.691.29 1.023.109.336.246.66.414.977ZM8.875 6l-2-2H20c.55 0 1.02.195 1.414.586.39.394.586.863.586 1.414Zm2.398 2.398Zm0 0"></path></g>

      <!-- Install-Desktop SVG for Web Install API -->
      <g id="install-desktop"><path d="M8 21v-2H4c-.55 0-1.02-.2-1.41-.59S2 17.55 2 17V5c0-.55.2-1.02.59-1.41S3.45 3 4 3h8v2H4v12h16v-3h2v3c0 .55-.2 1.02-.59 1.41S20.55 19 20 19h-4v2H8Zm9-7-5-5 1.4-1.4 2.6 2.58V3h2v7.18l2.6-2.58L22 9l-5 5Z"></path></g>
      <g id="install-desktop-off"><path d="m20 16.72 1.54 1.54c.3-.36.46-.78.46-1.26v-3h-2v2.72ZM8.28 5H12V3H6.28l2 2zM2.52 2.09 1.1 3.51l.97.97C2.03 4.64 2 4.81 2 5v12c0 .55.2 1.02.59 1.41S3.45 19 4 19h4v2h8v-2h.59l.29.29 2.62 2.62 1.43-1.42L2.52 2.09ZM4 17V6.41l3.3 3.3 5 5L14.59 17H4ZM17 14l-5-5 1.4-1.4 2.6 2.58V3h2v7.18l2.6-2.58L22 9l-5 5Z"></path></g>

      <!--
      These icons are copied from Polymer's iron-icons and kept in sorted order.
      See http://goo.gl/Y1OdAq for instructions on adding additional icons.
      -->
      <g id="bluetooth"><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"></path></g>
      <g id="bluetooth-off"><path d="M13 5.83l1.88 1.88-1.6 1.6 1.41 1.41 3.02-3.02L12 2h-1v5.03l2 2v-3.2zM5.41 4L4 5.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l4.29-4.29 2.3 2.29L20 18.59 5.41 4zM13 18.17v-3.76l1.88 1.88L13 18.17z"></path></g>
      <g id="bluetooth-scanning"><path d="M14.24 12.01l2.32 2.32c.28-.72.44-1.51.44-2.33 0-.82-.16-1.59-.43-2.31l-2.33 2.32zm5.29-5.3l-1.26 1.26c.63 1.21.98 2.57.98 4.02s-.36 2.82-.98 4.02l1.2 1.2a9.936 9.936 0 0 0 1.54-5.31c-.01-1.89-.55-3.67-1.48-5.19zm-3.82 1L10 2H9v7.59L4.41 5 3 6.41 8.59 12 3 17.59 4.41 19 9 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM11 5.83l1.88 1.88L11 9.59V5.83zm1.88 10.46L11 18.17v-3.76l1.88 1.88z"></path></g>
      <g id="cloud"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"></path></g>
      <g id="compose"><path d="M5.39583 9.97917C5.39583 8.70139 4.95139 7.61806 4.0625 6.72917C3.17361 5.84028 2.09028 5.39583 0.8125 5.39583C2.09028 5.39583 3.17361 4.95139 4.0625 4.0625C4.95139 3.17361 5.39583 2.08333 5.39583 0.791665C5.39583 2.08333 5.84028 3.17361 6.72917 4.0625C7.61806 4.95139 8.70139 5.39583 9.97917 5.39583C8.70139 5.39583 7.61806 5.84028 6.72917 6.72917C5.84028 7.61806 5.39583 8.70139 5.39583 9.97917ZM5.39583 15.6042H6.39583L14.125 7.85417L13.625 7.33333L13.1458 6.875L5.39583 14.625V15.6042ZM3.83333 17.1667V13.9583L14.25 3.52083C14.5694 3.21528 14.9444 3.0625 15.375 3.0625C15.8056 3.0625 16.1736 3.21528 16.4792 3.52083L17.4792 4.52083C17.7847 4.82639 17.9375 5.20139 17.9375 5.64583C17.9375 6.07639 17.7847 6.44444 17.4792 6.75L7.04167 17.1667H3.83333ZM16.3333 5.58333L15.3542 4.64583L16.3333 5.58333ZM14.125 7.85417L13.625 7.33333L13.1458 6.875L14.125 7.85417Z"></path></g>
      <g id="devices" viewBox="0 -960 960 960"><path d="M96-192v-96h96v-408q0-29.7 21.15-50.85Q234.3-768 264-768h552v72H264v408h216v96H96Zm516.28 0q-15.28 0-25.78-10.34-10.5-10.34-10.5-25.63v-359.74q0-15.29 10.34-25.79t25.62-10.5h215.76q15.28 0 25.78 10.34 10.5 10.34 10.5 25.63v359.74q0 15.29-10.34 25.79T828.04-192H612.28ZM648-288h144v-264H648v264Zm0 0h144-144Z"></path></g>
      <g id="email"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"></path></g>
      <g id="feedback" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17l-.59.59-.58.58V4h16v12zm-9-4h2v2h-2zm0-6h2v4h-2z"></path></g>
      <g id="language"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"></path></g>
      <g id="location-on" viewBox="0 -960 960 960">
        <path d="M480.28-96q-13.71 0-23.49-7.5Q447-111 443-123q-19-53-45.5-100.5T321-335q-49-63-79.5-121T211-595.21Q211-707 289.3-785.5 367.6-864 480-864q112.4 0 190.7 78.42Q749-707.15 749-594.57q0 87.57-33.5 145.07T639-335q-52 68-78.5 114.5T517-123q-5 12-14.5 19.5T480.28-96ZM480-223q17-34 38.5-67.27Q540-323.55 582-379q42-54 68.5-100.36Q677-525.71 677-595q0-81-58-139t-139.5-58q-81.5 0-139 58T283-595q0 69.29 27 115.64Q337-433 378-379q42 55.45 63.5 88.73Q463-257 480-223Zm0-275q40 0 68.5-28.5T577-595q0-40-28.5-68.5T480-692q-40 0-68.5 28.5T383-595q0 40 28.5 68.5T480-498Zm0-97Z"></path>
      </g>
      <g id="performance"><path d="M0 0h24v24H0z" fill="none"></path><path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"></path></g>
      <g id="refresh"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path></g>
      <g id="sync-disabled"><path d="M10 6.35V4.26c-.8.21-1.55.54-2.23.96l1.46 1.46c.25-.12.5-.24.77-.33zm-7.14-.94l2.36 2.36C4.45 8.99 4 10.44 4 12c0 2.21.91 4.2 2.36 5.64L4 20h6v-6l-2.24 2.24C6.68 15.15 6 13.66 6 12c0-1 .25-1.94.68-2.77l8.08 8.08c-.25.13-.5.25-.77.34v2.09c.8-.21 1.55-.54 2.23-.96l2.36 2.36 1.27-1.27L4.14 4.14 2.86 5.41zM20 4h-6v6l2.24-2.24C17.32 8.85 18 10.34 18 12c0 1-.25 1.94-.68 2.77l1.46 1.46C19.55 15.01 20 13.56 20 12c0-2.21-.91-4.2-2.36-5.64L20 4z"></path></g>
      <g id="sync-problem"><path d="M3 12c0 2.21.91 4.2 2.36 5.64L3 20h6v-6l-2.24 2.24C5.68 15.15 5 13.66 5 12c0-2.61 1.67-4.83 4-5.65V4.26C5.55 5.15 3 8.27 3 12zm8 5h2v-2h-2v2zM21 4h-6v6l2.24-2.24C18.32 8.85 19 10.34 19 12c0 2.61-1.67 4.83-4 5.65v2.09c3.45-.89 6-4.01 6-7.74 0-2.21-.91-4.2-2.36-5.64L21 4zm-10 9h2V7h-2v6z"></path></g>
    </defs>
  </svg>
</cr-iconset>
`;
var iconsets$2 = div$2.querySelectorAll("cr-iconset");
for (const iconset of iconsets$2) document.head.appendChild(iconset);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/lifetime_browser_proxy.js
var LifetimeBrowserProxyImpl = class LifetimeBrowserProxyImpl {
	restart() {
		chrome.send("restart");
	}
	relaunch() {
		chrome.send("relaunch");
	}
	shouldShowRelaunchConfirmationDialog(alwaysShowDialog) {
		return sendWithPromise("shouldShowRelaunchConfirmationDialog", alwaysShowDialog);
	}
	getRelaunchConfirmationDialogDescription(isVersionUpdate) {
		return sendWithPromise("getRelaunchConfirmationDialogDescription", isVersionUpdate);
	}
	static getInstance() {
		return instance$34 || (instance$34 = new LifetimeBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$34 = obj;
	}
};
var instance$34 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/relaunch_confirmation_dialog.html.js
function getTemplate$27() {
	return Ke`<!--_html_template_start_--><cr-dialog id="dialog" close-text="$i18n{close}" show-on-attach>
  <div slot="title">$i18n{relaunchConfirmationDialogTitle}</div>
  <div slot="body">[[relaunchConfirmationDialogDesc]]</div>
  <div slot="button-container">
    <cr-button id="cancel" class="cancel-button" on-click="onDialogCancel_">
      $i18n{cancel}
    </cr-button>
    <cr-button id="confirm" class="action-button" on-click="onDialogConfirm_">
      $i18n{restart}
    </cr-button>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/relaunch_mixin.js
var RestartType;
(function(RestartType) {
	RestartType[RestartType["RESTART"] = 0] = "RESTART";
	RestartType[RestartType["RELAUNCH"] = 1] = "RELAUNCH";
})(RestartType || (RestartType = {}));
/**
* A helper Mixin to channel the relaunch/restart signal to native Chrome.
* This uses LifetimeBrowserProxy under the surface but additionally supports
* the <relaunch-confirmation-dialog> for non ChromeOS based desktop platforms.
*/
var RelaunchMixin = dedupingMixin((superClass) => {
	class RelaunchMixin extends superClass {
		lifetimeBrowserProxy_;
		static get properties() {
			return {
				shouldShowRelaunchDialog: {
					type: Boolean,
					value: false
				},
				restartTypeEnum: {
					type: Object,
					value: RestartType
				}
			};
		}
		constructor(...args) {
			super(...args);
			this.lifetimeBrowserProxy_ = LifetimeBrowserProxyImpl.getInstance();
		}
		onRelaunchDialogClose(_event) {
			this.shouldShowRelaunchDialog = false;
		}
		performRestartInternal_(restartType) {
			if (RestartType.RESTART === restartType) this.lifetimeBrowserProxy_.restart();
			else if (RestartType.RELAUNCH === restartType) this.lifetimeBrowserProxy_.relaunch();
			else assertNotReached();
		}
		async performRestartForNonChromeOs_(restartType, alwaysShowDialog) {
			if (!await this.lifetimeBrowserProxy_.shouldShowRelaunchConfirmationDialog(alwaysShowDialog)) {
				this.performRestartInternal_(restartType);
				return;
			}
			this.shouldShowRelaunchDialog = true;
		}
		/**
		* This either performs restart or relaunch depending on the function
		* argument restartType. For non ChromeOS platforms it shows the
		* additional <relaunch-confirmation-dialog> html element **if** that
		* was specified in the caller's DOM, **otherwise** doesn't do anything.
		* Please see, RelaunchConfirmationDialogElement for more information on
		* how to add the new <relaunch-confirmation-dialog> element in the DOM.
		*
		* @param restartType This specifies the type of restart to perform.
		* @param alwaysShowDialog Always show a confirmation dialog before the
		*     restart if this parameter is true. Otherwise, only when there is
		*     an incognito window open.
		*/
		performRestart(restartType, alwaysShowDialog) {
			if (alwaysShowDialog == null) alwaysShowDialog = false;
			this.performRestartForNonChromeOs_(restartType, alwaysShowDialog);
		}
	}
	return RelaunchMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/relaunch_confirmation_dialog.js
/**
* The polymer element corresponding to <relaunch-confirmation-dialog>.
* The dialog is only supported for "non" ChromeOS platforms and is
* shown to warn users if they have any open Incognito windows before
* proceeding with the restart/relaunch action.
*
* To make use of this dialog, add the below html to the target html and
* substitute the value of restart-type to either restartTypeEnum.RELAUNCH or
* restartTypeEnum.RESTART.
*
* <template is="dom-if" if="[[shouldShowRelaunchDialog]]" restamp>
*   <relaunch-confirmation-dialog restart-type="[[restartTypeEnum.RELAUNCH]]"
* on-close="onRelaunchDialogClose"></relaunch-confirmation-dialog>
* </template>
*
* Then, in the corresponding typescript file, make the target HTMLElement
* inherit from RelaunchMixin and invoke the member method
* RelaunchMixin#performRestart where required.
*/
var RelaunchConfirmationDialogElement = class extends PolymerElement {
	static get is() {
		return "relaunch-confirmation-dialog";
	}
	static get template() {
		return getTemplate$27();
	}
	static get properties() {
		return {
			relaunchConfirmationDialogDesc: String,
			restartType: Object,
			isVersionUpdate: {
				type: Boolean,
				value: false
			}
		};
	}
	async connectedCallback() {
		super.connectedCallback();
		this.relaunchConfirmationDialogDesc = await LifetimeBrowserProxyImpl.getInstance().getRelaunchConfirmationDialogDescription(this.isVersionUpdate);
	}
	onDialogCancel_() {
		this.$.dialog.cancel();
	}
	onDialogConfirm_() {
		if (RestartType.RELAUNCH === this.restartType) LifetimeBrowserProxyImpl.getInstance().relaunch();
		else if (RestartType.RESTART === this.restartType) LifetimeBrowserProxyImpl.getInstance().restart();
		else assertNotReached();
	}
};
customElements.define(RelaunchConfirmationDialogElement.is, RelaunchConfirmationDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_hidden_style_lit.css.js
var instance$33 = null;
function getCss$13() {
	return instance$33 || (instance$33 = [...[], i$4`[hidden],:host([hidden]){display:none !important}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon/cr_icon.css.js
var instance$32 = null;
function getCss$12() {
	return instance$32 || (instance$32 = [...[getCss$13()], i$4`:host{align-items:center;display:inline-flex;justify-content:center;position:relative;vertical-align:middle;fill:var(--iron-icon-fill-color,currentcolor);stroke:var(--iron-icon-stroke-color,none);width:var(--iron-icon-width,24px);height:var(--iron-icon-height,24px)}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon/cr_icon.js
var CrIconElement = class extends CrLitElement {
	static get is() {
		return "cr-icon";
	}
	static get styles() {
		return getCss$12();
	}
	static get properties() {
		return { 
		/**
		* The name of the icon to use. The name should be of the form:
		* `iconset_name:icon_name`.
		*/
icon: { type: String } };
	}
	#icon_accessor_storage = "";
	get icon() {
		return this.#icon_accessor_storage;
	}
	set icon(value) {
		this.#icon_accessor_storage = value;
	}
	iconsetName_ = "";
	iconName_ = "";
	iconset_ = null;
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("icon")) {
			const [iconsetName, iconName] = this.icon.split(":");
			this.iconName_ = iconName || "";
			this.iconsetName_ = iconsetName || "";
			this.updateIcon_();
		}
	}
	updateIcon_() {
		if (this.iconName_ === "" && this.iconset_) this.iconset_.removeIcon(this);
		else if (this.iconsetName_) {
			const iconsetMap = IconsetMap.getInstance();
			this.iconset_ = iconsetMap.get(this.iconsetName_);
			assert$1(this.iconset_, `Could not find iconset for: '${this.iconsetName_}:${this.iconName_}'`);
			this.iconset_.applyIcon(this, this.iconName_);
		}
	}
};
customElements.define(CrIconElement.is, CrIconElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/event_tracker.js
/**
* @fileoverview EventTracker is a simple class that manages the addition and
* removal of DOM event listeners. In particular, it keeps track of all
* listeners that have been added and makes it easy to remove some or all of
* them without requiring all the information again. This is particularly handy
* when the listener is a generated function such as a lambda or the result of
* calling Function.bind.
*/
var EventTracker = class EventTracker {
	listeners_ = [];
	/**
	* Add an event listener - replacement for EventTarget.addEventListener.
	* @param target The DOM target to add a listener to.
	* @param eventType The type of event to subscribe to.
	* @param listener The listener to add.
	* @param capture Whether to invoke during the capture phase. Defaults to
	*     false.
	*/
	add(target, eventType, listener, capture = false) {
		const h = {
			target,
			eventType,
			listener,
			capture
		};
		this.listeners_.push(h);
		target.addEventListener(eventType, listener, capture);
	}
	/**
	* Remove any specified event listeners added with this EventTracker.
	* @param target The DOM target to remove a listener from.
	* @param eventType The type of event to remove.
	*/
	remove(target, eventType) {
		this.listeners_ = this.listeners_.filter((listener) => {
			if (listener.target === target && (!eventType || listener.eventType === eventType)) {
				EventTracker.removeEventListener(listener);
				return false;
			}
			return true;
		});
	}
	/** Remove all event listeners added with this EventTracker. */
	removeAll() {
		this.listeners_.forEach((listener) => EventTracker.removeEventListener(listener));
		this.listeners_ = [];
	}
	/**
	* Remove a single event listener given it's tracking entry. It's up to the
	* caller to ensure the entry is removed from listeners_.
	* @param entry The entry describing the listener to
	* remove.
	*/
	static removeEventListener(entry) {
		entry.target.removeEventListener(entry.eventType, entry.listener, entry.capture);
	}
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_ripple/cr_ripple.css.js
var instance$31 = null;
function getCss$11() {
	return instance$31 || (instance$31 = [...[], i$4`:host{bottom:0;display:block;left:0;overflow:hidden;pointer-events:none;position:absolute;right:0;top:0;transform:translate3d(0,0,0)}.ripple{background-color:currentcolor;left:0;opacity:var(--paper-ripple-opacity,0.25);pointer-events:none;position:absolute;will-change:height,transform,width}.ripple,:host(.circle){border-radius:50%}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_ripple/cr_ripple.js
var MAX_RADIUS_PX = 300;
var MIN_DURATION_MS = 800;
/** @return The distance between (x1, y1) and (x2, y2). */
function distance(x1, y1, x2, y2) {
	const xDelta = x1 - x2;
	const yDelta = y1 - y2;
	return Math.sqrt(xDelta * xDelta + yDelta * yDelta);
}
var CrRippleElement = class extends CrLitElement {
	static get is() {
		return "cr-ripple";
	}
	static get styles() {
		return getCss$11();
	}
	static get properties() {
		return {
			holdDown: { type: Boolean },
			recenters: { type: Boolean },
			noink: { type: Boolean }
		};
	}
	#holdDown_accessor_storage = false;
	get holdDown() {
		return this.#holdDown_accessor_storage;
	}
	set holdDown(value) {
		this.#holdDown_accessor_storage = value;
	}
	#recenters_accessor_storage = false;
	get recenters() {
		return this.#recenters_accessor_storage;
	}
	set recenters(value) {
		this.#recenters_accessor_storage = value;
	}
	#noink_accessor_storage = false;
	get noink() {
		return this.#noink_accessor_storage;
	}
	set noink(value) {
		this.#noink_accessor_storage = value;
	}
	ripples_ = [];
	eventTracker_ = new EventTracker();
	connectedCallback() {
		super.connectedCallback();
		assert$1(this.parentNode);
		const keyEventTarget = this.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? this.parentNode.host : this.parentElement;
		this.eventTracker_.add(keyEventTarget, "pointerdown", (e) => this.uiDownAction(e));
		this.eventTracker_.add(keyEventTarget, "pointerup", () => this.uiUpAction());
		this.eventTracker_.add(keyEventTarget, "pointerout", () => this.uiUpAction());
		this.eventTracker_.add(keyEventTarget, "keydown", (e) => {
			if (e.defaultPrevented) return;
			if (e.key === "Enter") {
				this.onEnterKeydown_();
				return;
			}
			if (e.key === " ") this.onSpaceKeydown_();
		});
		this.eventTracker_.add(keyEventTarget, "keyup", (e) => {
			if (e.defaultPrevented) return;
			if (e.key === " ") this.onSpaceKeyup_();
		});
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		this.eventTracker_.removeAll();
	}
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("holdDown")) this.holdDownChanged_(this.holdDown, changedProperties.get("holdDown"));
	}
	uiDownAction(e) {
		if (e !== void 0 && e.button !== 0) return;
		if (!this.noink) this.downAction_(e);
	}
	downAction_(e) {
		if (this.ripples_.length && this.holdDown) return;
		this.showRipple_(e);
	}
	clear() {
		this.hideRipple_();
		this.holdDown = false;
	}
	showAndHoldDown() {
		this.ripples_.forEach((ripple) => {
			ripple.remove();
		});
		this.ripples_ = [];
		this.holdDown = true;
	}
	showRipple_(e) {
		const rect = this.getBoundingClientRect();
		const roundedCenterX = function() {
			return Math.round(rect.width / 2);
		};
		const roundedCenterY = function() {
			return Math.round(rect.height / 2);
		};
		let x = 0;
		let y = 0;
		const centered = !e;
		if (centered) {
			x = roundedCenterX();
			y = roundedCenterY();
		} else {
			x = Math.round(e.clientX - rect.left);
			y = Math.round(e.clientY - rect.top);
		}
		const cornerDistances = [
			{
				x: 0,
				y: 0
			},
			{
				x: rect.width,
				y: 0
			},
			{
				x: 0,
				y: rect.height
			},
			{
				x: rect.width,
				y: rect.height
			}
		].map(function(corner) {
			return Math.round(distance(x, y, corner.x, corner.y));
		});
		const radius = Math.min(MAX_RADIUS_PX, Math.max.apply(Math, cornerDistances));
		const startTranslate = `${x - radius}px, ${y - radius}px`;
		let endTranslate = startTranslate;
		if (this.recenters && !centered) endTranslate = `${roundedCenterX() - radius}px, ${roundedCenterY() - radius}px`;
		const ripple = document.createElement("div");
		ripple.classList.add("ripple");
		ripple.style.height = ripple.style.width = 2 * radius + "px";
		this.ripples_.push(ripple);
		this.shadowRoot.appendChild(ripple);
		ripple.animate({ transform: [`translate(${startTranslate}) scale(0)`, `translate(${endTranslate}) scale(1)`] }, {
			duration: Math.max(MIN_DURATION_MS, Math.log(radius) * radius) || 0,
			easing: "cubic-bezier(.2, .9, .1, .9)",
			fill: "forwards"
		});
	}
	uiUpAction() {
		if (!this.noink) this.upAction_();
	}
	upAction_() {
		if (!this.holdDown) this.hideRipple_();
	}
	hideRipple_() {
		if (this.ripples_.length === 0) return;
		this.ripples_.forEach(function(ripple) {
			const opacity = ripple.computedStyleMap().get("opacity");
			if (opacity === null) {
				ripple.remove();
				return;
			}
			ripple.animate({ opacity: [opacity.value, 0] }, {
				duration: 150,
				fill: "forwards"
			}).finished.then(() => {
				ripple.remove();
			});
		});
		this.ripples_ = [];
	}
	onEnterKeydown_() {
		this.uiDownAction();
		window.setTimeout(() => {
			this.uiUpAction();
		}, 1);
	}
	onSpaceKeydown_() {
		this.uiDownAction();
	}
	onSpaceKeyup_() {
		this.uiUpAction();
	}
	holdDownChanged_(newHoldDown, oldHoldDown) {
		if (oldHoldDown === void 0) return;
		if (newHoldDown) this.downAction_();
		else this.upAction_();
	}
};
customElements.define(CrRippleElement.is, CrRippleElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_ripple/cr_ripple_mixin.js
var CrRippleMixin = (superClass) => {
	class CrRippleMixin extends superClass {
		static get properties() {
			return { 
			/**
			* If true, the element will not produce a ripple effect when
			* interacted with via the pointer.
			*/
noink: { type: Boolean } };
		}
		#noink_accessor_storage = false;
		get noink() {
			return this.#noink_accessor_storage;
		}
		set noink(value) {
			this.#noink_accessor_storage = value;
		}
		rippleContainer = null;
		ripple_ = null;
		updated(changedProperties) {
			super.updated(changedProperties);
			if (changedProperties.has("noink") && this.hasRipple()) {
				assert$1(this.ripple_);
				this.ripple_.noink = this.noink;
			}
		}
		ensureRippleOnPointerdown() {
			this.addEventListener("pointerdown", () => this.ensureRipple(), { capture: true });
		}
		/**
		* Ensures this element contains a ripple effect. For startup efficiency
		* the ripple effect is dynamically added on demand when needed.
		*/
		ensureRipple() {
			if (this.hasRipple()) return;
			this.ripple_ = this.createRipple();
			this.ripple_.noink = this.noink;
			const rippleContainer = this.rippleContainer || this.shadowRoot;
			assert$1(rippleContainer);
			rippleContainer.appendChild(this.ripple_);
		}
		/**
		* Returns the `<cr-ripple>` element used by this element to create
		* ripple effects. The element's ripple is created on demand, when
		* necessary, and calling this method will force the
		* ripple to be created.
		*/
		getRipple() {
			this.ensureRipple();
			assert$1(this.ripple_);
			return this.ripple_;
		}
		/**
		* Returns true if this element currently contains a ripple effect.
		*/
		hasRipple() {
			return Boolean(this.ripple_);
		}
		/**
		* Create the element's ripple effect via creating a `<cr-ripple
		* id="ink">` instance. Override this method to customize the ripple
		* element.
		*/
		createRipple() {
			const ripple = document.createElement("cr-ripple");
			ripple.id = "ink";
			return ripple;
		}
	}
	return CrRippleMixin;
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_shared_vars.css.js
var sheet$1 = new CSSStyleSheet();
sheet$1.replaceSync(`html{--google-blue-50-rgb:232,240,254;--google-blue-50:rgb(var(--google-blue-50-rgb));--google-blue-100-rgb:210,227,252;--google-blue-100:rgb(var(--google-blue-100-rgb));--google-blue-200-rgb:174,203,250;--google-blue-200:rgb(var(--google-blue-200-rgb));--google-blue-300-rgb:138,180,248;--google-blue-300:rgb(var(--google-blue-300-rgb));--google-blue-400-rgb:102,157,246;--google-blue-400:rgb(var(--google-blue-400-rgb));--google-blue-500-rgb:66,133,244;--google-blue-500:rgb(var(--google-blue-500-rgb));--google-blue-600-rgb:26,115,232;--google-blue-600:rgb(var(--google-blue-600-rgb));--google-blue-700-rgb:25,103,210;--google-blue-700:rgb(var(--google-blue-700-rgb));--google-blue-800-rgb:24,90,188;--google-blue-800:rgb(var(--google-blue-800-rgb));--google-blue-900-rgb:23,78,166;--google-blue-900:rgb(var(--google-blue-900-rgb));--google-green-50-rgb:230,244,234;--google-green-50:rgb(var(--google-green-50-rgb));--google-green-200-rgb:168,218,181;--google-green-200:rgb(var(--google-green-200-rgb));--google-green-300-rgb:129,201,149;--google-green-300:rgb(var(--google-green-300-rgb));--google-green-400-rgb:91,185,116;--google-green-400:rgb(var(--google-green-400-rgb));--google-green-500-rgb:52,168,83;--google-green-500:rgb(var(--google-green-500-rgb));--google-green-600-rgb:30,142,62;--google-green-600:rgb(var(--google-green-600-rgb));--google-green-700-rgb:24,128,56;--google-green-700:rgb(var(--google-green-700-rgb));--google-green-800-rgb:19,115,51;--google-green-800:rgb(var(--google-green-800-rgb));--google-green-900-rgb:13,101,45;--google-green-900:rgb(var(--google-green-900-rgb));--google-grey-50-rgb:248,249,250;--google-grey-50:rgb(var(--google-grey-50-rgb));--google-grey-100-rgb:241,243,244;--google-grey-100:rgb(var(--google-grey-100-rgb));--google-grey-200-rgb:232,234,237;--google-grey-200:rgb(var(--google-grey-200-rgb));--google-grey-300-rgb:218,220,224;--google-grey-300:rgb(var(--google-grey-300-rgb));--google-grey-400-rgb:189,193,198;--google-grey-400:rgb(var(--google-grey-400-rgb));--google-grey-500-rgb:154,160,166;--google-grey-500:rgb(var(--google-grey-500-rgb));--google-grey-600-rgb:128,134,139;--google-grey-600:rgb(var(--google-grey-600-rgb));--google-grey-700-rgb:95,99,104;--google-grey-700:rgb(var(--google-grey-700-rgb));--google-grey-800-rgb:60,64,67;--google-grey-800:rgb(var(--google-grey-800-rgb));--google-grey-900-rgb:32,33,36;--google-grey-900:rgb(var(--google-grey-900-rgb));--google-grey-900-white-4-percent:#292a2d;--google-purple-200-rgb:215,174,251;--google-purple-200:rgb(var(--google-purple-200-rgb));--google-purple-900-rgb:104,29,168;--google-purple-900:rgb(var(--google-purple-900-rgb));--google-red-100-rgb:244,199,195;--google-red-100:rgb(var(--google-red-100-rgb));--google-red-300-rgb:242,139,130;--google-red-300:rgb(var(--google-red-300-rgb));--google-red-500-rgb:234,67,53;--google-red-500:rgb(var(--google-red-500-rgb));--google-red-600-rgb:217,48,37;--google-red-600:rgb(var(--google-red-600-rgb));--google-red-700-rgb:197,57,41;--google-red-700:rgb(var(--google-red-700-rgb));--google-yellow-50-rgb:254,247,224;--google-yellow-50:rgb(var(--google-yellow-50-rgb));--google-yellow-100-rgb:254,239,195;--google-yellow-100:rgb(var(--google-yellow-100-rgb));--google-yellow-200-rgb:253,226,147;--google-yellow-200:rgb(var(--google-yellow-200-rgb));--google-yellow-300-rgb:253,214,51;--google-yellow-300:rgb(var(--google-yellow-300-rgb));--google-yellow-400-rgb:252,201,52;--google-yellow-400:rgb(var(--google-yellow-400-rgb));--google-yellow-500-rgb:251,188,4;--google-yellow-500:rgb(var(--google-yellow-500-rgb));--google-yellow-700-rgb:240,147,0;--google-yellow-700:rgb(var(--google-yellow-700-rgb));--cr-card-background-color:white;--cr-shadow-key-color_:color-mix(in srgb,var(--cr-shadow-color) 30%,transparent);--cr-shadow-ambient-color_:color-mix(in srgb,var(--cr-shadow-color) 15%,transparent);--cr-elevation-1:var(--cr-shadow-key-color_) 0 1px 2px 0,var(--cr-shadow-ambient-color_) 0 1px 3px 1px;--cr-elevation-2:var(--cr-shadow-key-color_) 0 1px 2px 0,var(--cr-shadow-ambient-color_) 0 2px 6px 2px;--cr-elevation-3:var(--cr-shadow-key-color_) 0 1px 3px 0,var(--cr-shadow-ambient-color_) 0 4px 8px 3px;--cr-elevation-4:var(--cr-shadow-key-color_) 0 2px 3px 0,var(--cr-shadow-ambient-color_) 0 6px 10px 4px;--cr-elevation-5:var(--cr-shadow-key-color_) 0 4px 4px 0,var(--cr-shadow-ambient-color_) 0 8px 12px 6px;--cr-card-shadow:var(--cr-elevation-2);--cr-focused-item-color:var(--google-grey-300);--cr-form-field-label-color:var(--google-grey-700);--cr-hairline-rgb:0,0,0;--cr-iph-anchor-highlight-color:rgba(var(--google-blue-600-rgb),0.1);--cr-menu-background-color:white;--cr-menu-background-focus-color:var(--google-grey-400);--cr-menu-shadow:var(--cr-elevation-2);--cr-separator-color:rgba(0,0,0,.06);--cr-title-text-color:rgb(90,90,90);--cr-scrollable-border-color:var(--google-grey-300);--cr-button-edge-spacing:12px;--cr-controlled-by-spacing:24px;--cr-default-input-max-width:264px;--cr-icon-ripple-size:36px;--cr-icon-ripple-padding:8px;--cr-icon-size:20px;--cr-icon-button-margin-start:16px;--cr-icon-ripple-margin:calc(var(--cr-icon-ripple-padding) * -1);--cr-section-min-height:48px;--cr-section-two-line-min-height:64px;--cr-section-padding:20px;--cr-section-vertical-padding:12px;--cr-section-indent-width:40px;--cr-section-indent-padding:calc(var(--cr-section-padding) + var(--cr-section-indent-width));--cr-section-vertical-margin:21px;--cr-centered-card-max-width:680px;--cr-centered-card-width-percentage:0.96;--cr-hairline:1px solid rgba(var(--cr-hairline-rgb),.14);--cr-separator-height:1px;--cr-separator-line:var(--cr-separator-height) solid var(--cr-separator-color);--cr-toolbar-overlay-animation-duration:150ms;--cr-toolbar-height:56px;--cr-card-border-radius:8px;--cr-disabled-opacity:.38;--cr-form-field-bottom-spacing:16px;--cr-form-field-label-font-size:.625rem;--cr-form-field-label-height:1em;--cr-form-field-label-line-height:1;--cr-fallback-color-outline:rgb(116,119,117);--cr-fallback-color-primary:rgb(11,87,208);--cr-fallback-color-on-primary:rgb(255,255,255);--cr-fallback-color-primary-container:rgb(211,227,253);--cr-fallback-color-on-primary-container:rgb(4,30,73);--cr-fallback-color-secondary-container:rgb(194,231,255);--cr-fallback-color-on-secondary-container:rgb(0,29,53);--cr-fallback-color-neutral-container:rgb(242,242,242);--cr-fallback-color-neutral-outline:rgb(199,199,199);--cr-fallback-color-surface:rgb(255,255,255);--cr-fallback-color-surface1:rgb(248,250,253);--cr-fallback-color-surface2:rgb(243,246,252);--cr-fallback-color-surface3:rgb(239,243,250);--cr-fallback-color-surface5:rgb(234,240,249);--cr-fallback-color-on-surface-rgb:31,31,31;--cr-fallback-color-on-surface:rgb(var(--cr-fallback-color-on-surface-rgb));--cr-fallback-color-surface-variant:rgb(225,227,225);--cr-fallback-color-on-surface-variant:rgb(68,71,70);--cr-fallback-color-on-surface-subtle:rgb(71,71,71);--cr-fallback-color-inverse-primary:rgb(168,199,250);--cr-fallback-color-inverse-surface:rgb(48,48,48);--cr-fallback-color-inverse-on-surface:rgb(242,242,242);--cr-fallback-color-tonal-container:rgb(211,227,253);--cr-fallback-color-on-tonal-container:rgb(4,30,73);--cr-fallback-color-tonal-outline:rgb(168,199,250);--cr-fallback-color-error:rgb(179,38,30);--cr-fallback-color-divider:rgb(211,227,253);--cr-fallback-color-state-hover-on-prominent_:rgba(253,252,251,.1);--cr-fallback-color-state-on-subtle-rgb_:31,31,31;--cr-fallback-color-state-hover-on-subtle_:rgba(var(--cr-fallback-color-state-on-subtle-rgb_),.06);--cr-fallback-color-state-ripple-neutral-on-subtle_:rgba(var(--cr-fallback-color-state-on-subtle-rgb_),.08);--cr-fallback-color-state-ripple-primary-rgb_:124,172,248;--cr-fallback-color-state-ripple-primary_:rgba(var(--cr-fallback-color-state-ripple-primary-rgb_),0.32);--cr-fallback-color-base-container:rgb(236,239,247);--cr-fallback-color-disabled-background:rgba(var(--cr-fallback-color-on-surface-rgb),.12);--cr-fallback-color-disabled-foreground:rgba(var(--cr-fallback-color-on-surface-rgb),var(--cr-disabled-opacity));--cr-hover-background-color:var(--color-sys-state-hover,rgba(var(--cr-fallback-color-on-surface-rgb),.08));--cr-hover-on-prominent-background-color:var(--color-sys-state-hover-on-prominent,var(--cr-fallback-color-state-hover-on-prominent_));--cr-hover-on-subtle-background-color:var(--color-sys-state-hover-on-subtle,var(--cr-fallback-color-state-hover-on-subtle_));--cr-active-background-color:var(--color-sys-state-pressed,rgba(var(--cr-fallback-color-on-surface-rgb),.12));--cr-active-on-primary-background-color:var(--color-sys-state-ripple-primary,var(--cr-fallback-color-state-ripple-primary_));--cr-active-neutral-on-subtle-background-color:var(--color-sys-state-ripple-neutral-on-subtle,var(--cr-fallback-color-state-ripple-neutral-on-subtle_));--cr-focus-outline-color:var(--color-sys-state-focus-ring,var(--cr-fallback-color-primary));--cr-focus-outline-inverse-color:var(--color-sys-state-focus-ring-inverse,var(--cr-fallback-color-inverse-primary));--cr-primary-text-color:var(--color-primary-foreground,var(--cr-fallback-color-on-surface));--cr-secondary-text-color:var(--color-secondary-foreground,var(--cr-fallback-color-on-surface-variant));--cr-link-color:var(--color-link-foreground-default,var(--cr-fallback-color-primary));--cr-button-height:36px;--cr-shadow-color:var(--color-sys-shadow,rgb(0,0,0));--cr-checked-color:var(--color-checkbox-foreground-checked,var(--cr-fallback-color-primary))}@media (prefers-color-scheme:dark){html{--cr-fallback-color-outline:rgb(142,145,143);--cr-fallback-color-primary:rgb(168,199,250);--cr-fallback-color-on-primary:rgb(6,46,111);--cr-fallback-color-primary-container:rgb(8,66,160);--cr-fallback-color-on-primary-container:rgb(211,227,253);--cr-fallback-color-secondary-container:rgb(0,74,119);--cr-fallback-color-on-secondary-container:rgb(194,231,255);--cr-fallback-color-neutral-container:rgb(40,40,40);--cr-fallback-color-neutral-outline:rgb(117,117,117);--cr-fallback-color-surface:rgb(31,31,31);--cr-fallback-color-surface1:rgb(39,40,42);--cr-fallback-color-surface2:rgb(45,47,49);--cr-fallback-color-surface3:rgb(51,52,56);--cr-fallback-color-surface5:rgb(56,58,62);--cr-fallback-color-on-surface-rgb:227,227,227;--cr-fallback-color-surface-variant:rgb(68,71,70);--cr-fallback-color-on-surface-variant:rgb(196,199,197);--cr-fallback-color-on-surface-subtle:rgb(199,199,199);--cr-fallback-color-inverse-primary:rgb(11,87,208);--cr-fallback-color-inverse-surface:rgb(227,227,227);--cr-fallback-color-inverse-on-surface:rgb(31,31,31);--cr-fallback-color-tonal-container:rgb(0,74,119);--cr-fallback-color-on-tonal-container:rgb(194,231,255);--cr-fallback-color-tonal-outline:rgb(4,125,183);--cr-fallback-color-error:rgb(242,184,181);--cr-fallback-color-divider:rgb(94,94,94);--cr-fallback-color-state-hover-on-prominent_:rgba(31,31,31,.06);--cr-fallback-color-state-on-subtle-rgb_:253,252,251;--cr-fallback-color-state-hover-on-subtle_:rgba(var(--cr-fallback-color-state-on-subtle-rgb_),.10);--cr-fallback-color-state-ripple-neutral-on-subtle_:rgba(var(--cr-fallback-color-state-on-subtle-rgb_),.16);--cr-fallback-color-state-ripple-primary-rgb_:76,141,246;--cr-fallback-color-base-container:rgba(40,40,40,1);--cr-card-background-color:var(--google-grey-900-white-4-percent);--cr-focused-item-color:var(--google-grey-800);--cr-form-field-label-color:var(--dark-secondary-color);--cr-hairline-rgb:255,255,255;--cr-iph-anchor-highlight-color:rgba(var(--google-grey-100-rgb),0.1);--cr-menu-background-color:var(--google-grey-900);--cr-menu-background-focus-color:var(--google-grey-700);--cr-menu-background-sheen:rgba(255,255,255,.06);--cr-menu-shadow:rgba(0,0,0,.3) 0 1px 2px 0,rgba(0,0,0,.15) 0 3px 6px 2px;--cr-separator-color:rgba(255,255,255,.1);--cr-title-text-color:var(--cr-primary-text-color);--cr-scrollable-border-color:var(--google-grey-700)}}@media (forced-colors:active){html{--cr-focus-outline-hcm:2px solid transparent;--cr-border-hcm:2px solid transparent;--cr-fallback-color-disabled-background:Canvas;--cr-fallback-color-disabled-foreground:GrayText}}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet$1];
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon_button/cr_icon_button.css.js
var instance$30 = null;
function getCss$10() {
	return instance$30 || (instance$30 = [...[], i$4`:host{--cr-icon-button-fill-color:currentColor;--cr-icon-button-icon-start-offset:0;--cr-icon-button-icon-size:20px;--cr-icon-button-size:32px;--cr-icon-button-height:var(--cr-icon-button-size);--cr-icon-button-transition:150ms ease-in-out;--cr-icon-button-width:var(--cr-icon-button-size);-webkit-tap-highlight-color:transparent;border-radius:50%;color:var(--cr-icon-button-stroke-color,var(--cr-icon-button-fill-color));cursor:pointer;display:inline-flex;flex-shrink:0;height:var(--cr-icon-button-height);margin-inline-end:var(--cr-icon-button-margin-end,var(--cr-icon-ripple-margin));margin-inline-start:var(--cr-icon-button-margin-start);outline:none;overflow:hidden;position:relative;user-select:none;vertical-align:middle;width:var(--cr-icon-button-width)}:host(:hover){background-color:var(--cr-icon-button-hover-background-color,var(--cr-hover-background-color))}:host(:focus-visible:focus){box-shadow:inset 0 0 0 2px var(--cr-icon-button-focus-outline-color,var(--cr-focus-outline-color))}@media (forced-colors:active){:host(:focus-visible:focus){outline:var(--cr-focus-outline-hcm)}}#ink{--paper-ripple-opacity:1;color:var(--cr-icon-button-active-background-color,var(--cr-active-background-color))}:host([disabled]){cursor:initial;opacity:var(--cr-disabled-opacity);pointer-events:none}:host(.no-overlap){--cr-icon-button-margin-end:0;--cr-icon-button-margin-start:0}:host-context([dir=rtl]):host(:not([suppress-rtl-flip]):not([multiple-icons_])){transform:scaleX(-1)}:host-context([dir=rtl]):host(:not([suppress-rtl-flip])[multiple-icons_]) cr-icon{transform:scaleX(-1)}:host(:not([iron-icon])) #maskedImage{-webkit-mask-image:var(--cr-icon-image);-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;-webkit-mask-size:var(--cr-icon-button-icon-size);-webkit-transform:var(--cr-icon-image-transform,none);background-color:var(--cr-icon-button-fill-color);height:100%;transition:background-color var(--cr-icon-button-transition);width:100%}@media (forced-colors:active){:host(:not([iron-icon])) #maskedImage{background-color:ButtonText}}#icon{align-items:center;border-radius:4px;display:flex;height:100%;justify-content:center;padding-inline-start:var(--cr-icon-button-icon-start-offset);position:relative;width:100%}cr-icon{--iron-icon-fill-color:var(--cr-icon-button-fill-color);--iron-icon-stroke-color:var(--cr-icon-button-stroke-color,none);--iron-icon-height:var(--cr-icon-button-icon-size);--iron-icon-width:var(--cr-icon-button-icon-size);transition:fill var(--cr-icon-button-transition),stroke var(--cr-icon-button-transition)}@media (prefers-color-scheme:dark){:host{--cr-icon-button-fill-color:var(--google-grey-500)}}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon_button/cr_icon_button.html.js
function getHtml$7() {
	return x`
<div id="icon">
  <div id="maskedImage"></div>
</div>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icon_button/cr_icon_button.js
var CrIconbuttonElementBase = CrRippleMixin(CrLitElement);
var CrIconButtonElement = class extends CrIconbuttonElementBase {
	static get is() {
		return "cr-icon-button";
	}
	static get styles() {
		return getCss$10();
	}
	render() {
		return getHtml$7.bind(this)();
	}
	static get properties() {
		return {
			disabled: {
				type: Boolean,
				reflect: true
			},
			ironIcon: {
				type: String,
				reflect: true
			},
			suppressRtlFlip: {
				type: Boolean,
				value: false,
				reflect: true
			},
			multipleIcons_: {
				type: Boolean,
				reflect: true
			}
		};
	}
	#disabled_accessor_storage = false;
	get disabled() {
		return this.#disabled_accessor_storage;
	}
	set disabled(value) {
		this.#disabled_accessor_storage = value;
	}
	#ironIcon_accessor_storage;
	get ironIcon() {
		return this.#ironIcon_accessor_storage;
	}
	set ironIcon(value) {
		this.#ironIcon_accessor_storage = value;
	}
	#multipleIcons__accessor_storage = false;
	get multipleIcons_() {
		return this.#multipleIcons__accessor_storage;
	}
	set multipleIcons_(value) {
		this.#multipleIcons__accessor_storage = value;
	}
	/**
	* It is possible to activate a tab when the space key is pressed down. When
	* this element has focus, the keyup event for the space key should not
	* perform a 'click'. |spaceKeyDown_| tracks when a space pressed and
	* handled by this element. Space keyup will only result in a 'click' when
	* |spaceKeyDown_| is true. |spaceKeyDown_| is set to false when element
	* loses focus.
	*/
	spaceKeyDown_ = false;
	constructor() {
		super();
		this.addEventListener("blur", this.onBlur_.bind(this));
		this.addEventListener("click", this.onClick_.bind(this));
		this.addEventListener("keydown", this.onKeyDown_.bind(this));
		this.addEventListener("keyup", this.onKeyUp_.bind(this));
		this.ensureRippleOnPointerdown();
	}
	willUpdate(changedProperties) {
		super.willUpdate(changedProperties);
		if (changedProperties.has("ironIcon")) {
			const icons = (this.ironIcon || "").split(",");
			this.multipleIcons_ = icons.length > 1;
		}
	}
	firstUpdated() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "button");
		if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
	}
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("disabled")) {
			this.setAttribute("aria-disabled", this.disabled ? "true" : "false");
			this.disabledChanged_(this.disabled, changedProperties.get("disabled"));
		}
		if (changedProperties.has("ironIcon")) this.onIronIconChanged_();
	}
	disabledChanged_(newValue, oldValue) {
		if (!newValue && oldValue === void 0) return;
		if (this.disabled) this.blur();
		this.setAttribute("tabindex", String(this.disabled ? -1 : 0));
	}
	onBlur_() {
		this.spaceKeyDown_ = false;
	}
	onClick_(e) {
		if (this.disabled) e.stopImmediatePropagation();
	}
	onIronIconChanged_() {
		this.shadowRoot.querySelectorAll("cr-icon").forEach((el) => el.remove());
		if (!this.ironIcon) return;
		(this.ironIcon || "").split(",").forEach(async (icon) => {
			const crIcon = document.createElement("cr-icon");
			crIcon.icon = icon;
			this.$.icon.appendChild(crIcon);
			await crIcon.updateComplete;
			crIcon.shadowRoot.querySelectorAll("svg, img").forEach((child) => child.setAttribute("role", "none"));
		});
	}
	onKeyDown_(e) {
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		e.stopPropagation();
		if (e.repeat) return;
		if (e.key === "Enter") this.click();
		else if (e.key === " ") this.spaceKeyDown_ = true;
	}
	onKeyUp_(e) {
		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
		}
		if (this.spaceKeyDown_ && e.key === " ") {
			this.spaceKeyDown_ = false;
			this.click();
		}
	}
};
customElements.define(CrIconButtonElement.is, CrIconButtonElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_page/settings_section.html.js
function getTemplate$26() {
	return Ke`<!--_html_template_start_-->    <style>:host{display:flex;flex-direction:column;outline:none;position:relative}#header{display:flex;justify-content:space-between;padding-inline-end:var(--cr-section-padding)}#header .title{color:var(--cr-primary-text-color);font-size:108%;font-weight:400;letter-spacing:.25px;margin-bottom:12px;margin-top:var(--cr-section-vertical-margin);outline:none;padding-bottom:4px;padding-top:8px}#feedback{margin-top:var(--cr-section-vertical-margin)}#card{background-color:var(--cr-card-background-color);border-radius:var(--cr-card-border-radius);box-shadow:var(--cr-card-shadow);flex:1;overflow:hidden}@media (forced-colors:active){#card{border:var(--cr-border-hcm)}}
    </style>
    <div id="header">
      <h2 id="title" class="title" tabindex="-1"
          aria-hidden$="[[getTitleHiddenStatus_(pageTitle)]]">[[pageTitle]]</h2>
      <template is="dom-if" if="[[showSendFeedbackButton]]">
        <cr-icon-button id="feedback" iron-icon="settings:feedback"
            aria-labelledby="title" suppress-rtl-flip
            aria-roledescription="$i18n{sendFeedbackButton}"
            on-click="onSendFeedbackClick_">
        </cr-icon-button>
      </template>
    </div>
    <div id="card">
      <slot></slot>
    </div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_page/settings_section.js
var SettingsSectionElement = class extends tn {
	static get is() {
		return "settings-section";
	}
	static get template() {
		return getTemplate$26();
	}
	static get properties() {
		return {
			/**
			* Title for the section header. Initialize so we can use the
			* getTitleHiddenStatus_ method for accessibility.
			*/
			pageTitle: {
				type: String,
				value: ""
			},
			/**
			* When this attribute is enabled, a send feedback button will be shown
			* that emits a 'send-feedback' event.
			*/
			showSendFeedbackButton: {
				type: Boolean,
				value: false
			}
		};
	}
	/**
	* Get the value to which to set the aria-hidden attribute of the section
	* heading.
	* @return A return value of false will not add aria-hidden while aria-hidden
	*    requires a string of 'true' to be hidden as per aria specs. This
	*    function ensures we have the right return type.
	*/
	getTitleHiddenStatus_() {
		return this.pageTitle ? false : "true";
	}
	focus() {
		this.shadowRoot.querySelector(".title").focus();
	}
	onSendFeedbackClick_() {
		this.dispatchEvent(new CustomEvent("send-feedback", {
			bubbles: true,
			composed: true
		}));
	}
};
customElements.define(SettingsSectionElement.is, SettingsSectionElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_hidden_style.css.js
var styleMod$11 = document.createElement("dom-module");
styleMod$11.appendChild(Ke`
  <template>
    <style>
[hidden],:host([hidden]){display:none !important}
    </style>
  </template>
`.content);
styleMod$11.register("cr-hidden-style");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icons.css.js
var styleMod$10 = document.createElement("dom-module");
styleMod$10.appendChild(Ke`
  <template>
    <style>
.icon-arrow-back{--cr-icon-image:url(//resources/images/icon_arrow_back.svg)}.icon-arrow-dropdown{--cr-icon-image:url(//resources/images/icon_arrow_dropdown.svg)}.icon-arrow-drop-down-cr23{--cr-icon-image:url(//resources/images/icon_arrow_drop_down_cr23.svg)}.icon-arrow-drop-up-cr23{--cr-icon-image:url(//resources/images/icon_arrow_drop_up_cr23.svg)}.icon-arrow-upward{--cr-icon-image:url(//resources/images/icon_arrow_upward.svg)}.icon-cancel{--cr-icon-image:url(//resources/images/icon_cancel.svg)}.icon-clear{--cr-icon-image:url(//resources/images/icon_clear.svg)}.icon-copy-content{--cr-icon-image:url(//resources/images/icon_copy_content.svg)}.icon-delete-gray{--cr-icon-image:url(//resources/images/icon_delete_gray.svg)}.icon-edit{--cr-icon-image:url(//resources/images/icon_edit.svg)}.icon-file{--cr-icon-image:url(//resources/images/icon_filetype_generic.svg)}.icon-folder-open{--cr-icon-image:url(//resources/images/icon_folder_open.svg)}.icon-picture-delete{--cr-icon-image:url(//resources/images/icon_picture_delete.svg)}.icon-expand-less{--cr-icon-image:url(//resources/images/icon_expand_less.svg)}.icon-expand-more{--cr-icon-image:url(//resources/images/icon_expand_more.svg)}.icon-external{--cr-icon-image:url(//resources/images/open_in_new.svg)}.icon-more-vert{--cr-icon-image:url(//resources/images/icon_more_vert.svg)}.icon-refresh{--cr-icon-image:url(//resources/images/icon_refresh.svg)}.icon-search{--cr-icon-image:url(//resources/images/icon_search.svg)}.icon-settings{--cr-icon-image:url(//resources/images/icon_settings.svg)}.icon-visibility{--cr-icon-image:url(//resources/images/icon_visibility.svg)}.icon-visibility-off{--cr-icon-image:url(//resources/images/icon_visibility_off.svg)}.icon-visibility-refresh{--cr-icon-image:url(//resources/images/icon_visibility_refresh.svg)}.icon-visibility-off-refresh{--cr-icon-image:url(//resources/images/icon_visibility_off_refresh.svg)}.subpage-arrow{--cr-icon-image:url(//resources/images/arrow_right.svg)}.cr-icon{-webkit-mask-image:var(--cr-icon-image);-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;-webkit-mask-size:var(--cr-icon-size);background-color:var(--cr-icon-color,var(--google-grey-700));flex-shrink:0;height:var(--cr-icon-ripple-size);margin-inline-end:var(--cr-icon-ripple-margin);margin-inline-start:var(--cr-icon-button-margin-start);user-select:none;width:var(--cr-icon-ripple-size)}:host-context([dir=rtl]) .cr-icon{transform:scaleX(-1)}.cr-icon.no-overlap{margin-inline-end:0;margin-inline-start:0}@media (prefers-color-scheme:dark){.cr-icon{background-color:var(--cr-icon-color,var(--google-grey-500))}}
    </style>
  </template>
`.content);
styleMod$10.register("cr-icons");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_shared_style.css.js
var styleMod$9 = document.createElement("dom-module");
styleMod$9.appendChild(Ke`
  <template>
    <style include="cr-hidden-style cr-icons">
[actionable]{cursor:pointer}.hr{border-top:var(--cr-separator-line)}iron-list.cr-separators>*:not([first]){border-top:var(--cr-separator-line)}[scrollable]{border-color:transparent;border-style:solid;border-width:1px 0;overflow-y:auto}[scrollable].is-scrolled{border-top-color:var(--cr-scrollable-border-color)}[scrollable].can-scroll:not(.scrolled-to-bottom){border-bottom-color:var(--cr-scrollable-border-color)}[scrollable] iron-list>:not(.no-outline):focus-visible,[selectable]:focus-visible,[selectable]>:focus-visible{outline:solid 2px var(--cr-focus-outline-color);outline-offset:-2px}.scroll-container{display:flex;flex-direction:column;min-height:1px}[selectable]>*{cursor:pointer}.cr-centered-card-container{box-sizing:border-box;display:block;height:inherit;margin:0 auto;max-width:var(--cr-centered-card-max-width);min-width:550px;position:relative;width:calc(100% * var(--cr-centered-card-width-percentage))}.cr-row{align-items:center;border-top:var(--cr-separator-line);display:flex;min-height:var(--cr-section-min-height);padding:0 var(--cr-section-padding)}.cr-row.first,.cr-row.continuation{border-top:none}.cr-row-gap{padding-inline-start:16px}.cr-button-gap{margin-inline-start:8px}paper-tooltip::part(tooltip),cr-tooltip::part(tooltip){border-radius:var(--paper-tooltip-border-radius,2px);font-size:92.31%;font-weight:500;max-width:330px;min-width:var(--paper-tooltip-min-width,200px);padding:var(--paper-tooltip-padding,10px 8px)}.cr-padded-text{padding-block-end:var(--cr-section-vertical-padding);padding-block-start:var(--cr-section-vertical-padding)}.cr-title-text{color:var(--cr-title-text-color);font-size:107.6923%;font-weight:500}.cr-secondary-text{color:var(--cr-secondary-text-color);font-weight:400}.cr-form-field-label{color:var(--cr-form-field-label-color);display:block;font-size:var(--cr-form-field-label-font-size);font-weight:500;letter-spacing:.4px;line-height:var(--cr-form-field-label-line-height);margin-bottom:8px}.cr-vertical-tab{align-items:center;display:flex}.cr-vertical-tab::before{border-radius:0 3px 3px 0;content:'';display:block;flex-shrink:0;height:var(--cr-vertical-tab-height,100%);width:4px}.cr-vertical-tab.selected::before{background:var(--cr-vertical-tab-selected-color,var(--cr-checked-color))}:host-context([dir=rtl]) .cr-vertical-tab::before{transform:scaleX(-1)}.iph-anchor-highlight{background-color:var(--cr-iph-anchor-highlight-color)}
    </style>
  </template>
`.content);
styleMod$9.register("cr-shared-style");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/search_highlight_style.css.js
var styleMod$8 = document.createElement("dom-module");
styleMod$8.appendChild(Ke`
  <template>
    <style>
.search-bubble{--search-bubble-color:#ffeb3b;position:absolute;z-index:1}.search-bubble-innards{align-items:center;background-color:var(--search-bubble-color);border-radius:2px;color:var(--google-grey-900);max-width:100px;min-width:64px;overflow:hidden;padding:4px 10px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.search-bubble-innards::after{background-color:var(--search-bubble-color);content:'';height:10px;left:calc(50% - 5px);position:absolute;top:-5px;transform:rotate(-45deg);width:10px;z-index:-1}.search-bubble-innards.above::after{bottom:-5px;top:auto;transform:rotate(-135deg)}
    </style>
  </template>
`.content);
styleMod$8.register("search-highlight-style");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_vars.css.js
var sheet = new CSSStyleSheet();
sheet.replaceSync(`html{--settings-error-color:var(--google-red-700);--iron-icon-fill-color:var(--google-grey-700);--iron-icon-height:var(--cr-icon-size);--iron-icon-width:var(--cr-icon-size);--cr-radio-group-item-padding:0}@media (prefers-color-scheme:dark){html{--iron-icon-fill-color:var(--google-grey-500);--settings-error-color:var(--google-red-300)}}`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_shared.css.js
var styleMod$7 = document.createElement("dom-module");
styleMod$7.appendChild(html`
  <template>
    <style include="cr-shared-style search-highlight-style">
a[is=action-link]{user-select:none}h2{align-items:center;align-self:flex-start;color:var(--cr-secondary-text-color);display:flex;font-size:inherit;font-weight:500;margin:0;padding-bottom:12px;padding-top:32px}cr-icon,iron-icon{flex-shrink:0}cr-icon.policy,iron-icon.policy{margin-inline-end:var(--cr-controlled-by-spacing)}iron-list{user-select:none}iron-list[risk-selection]{user-select:text}.separator+cr-icon-button{margin-inline-start:var(--cr-icon-ripple-margin)}.settings-box settings-toggle-button cr-button:last-of-type{margin-inline-end:16px}.settings-box cr-button+cr-button,.settings-box cr-button+controlled-button,.settings-box controlled-button+controlled-button,.settings-box controlled-button+cr-button{margin-inline-start:8px}a[href]{color:var(--cr-link-color)}.inherit-color{color:inherit !important}collapse-radio-button,controlled-radio-button,cr-radio-button{min-height:var(--cr-section-min-height)}cr-radio-group{width:100%}.text-elide{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.no-min-width{min-width:0}.header-aligned-button{margin-top:12px}.link-wrapper{align-items:center;display:flex;flex-grow:1}.list-frame{display:block;padding-block-end:0;padding-block-start:0;padding-inline-end:var(--cr-section-padding);padding-inline-start:var(--cr-section-indent-padding)}.list-item{align-items:center;display:flex;min-height:var(--cr-section-min-height);padding:0}.list-item.underbar{border-bottom:var(--cr-separator-line)}.list-item.selected{font-weight:500}.list-item .middle{flex:1;margin:8px 16px}.list-item>.start{flex:1}.list-button[is='action-link']{align-items:center;display:flex;flex:1;font-weight:500;min-height:inherit}:host-context(html:not(.focus-outline-visible)) .list-button[is='action-link']{outline:none}.two-line{min-height:var(--cr-section-two-line-min-height)}.settings-box{align-items:center;border-top:var(--cr-separator-line);display:flex;min-height:var(--cr-section-min-height);padding:0 var(--cr-section-padding)}.settings-box.no-padding{padding:0}.settings-box.no-padding .margin-matches-padding{margin:0 var(--cr-section-padding)}.settings-box.no-padding>.link-wrapper{padding:0 var(--cr-section-padding)}.settings-box.two-line{min-height:var(--cr-section-two-line-min-height)}.settings-box-text{box-sizing:border-box;padding-bottom:var(--cr-section-vertical-padding);padding-top:var(--cr-section-vertical-padding)}.settings-box.first,.settings-box.continuation{border-top:none}h2.first{padding-top:0}.settings-box.block{display:block}.single-column{align-items:flex-start;flex-direction:column;justify-content:center}.settings-box.line-only{min-height:0}.settings-box.embedded{padding-inline-start:var(--cr-section-indent-padding)}.secondary{color:var(--cr-secondary-text-color);font-weight:400}.secondary:empty{margin:0}.settings-box .middle{align-items:center;flex:auto;padding-inline-start:16px}.settings-box .middle.two-line,.settings-box .start.two-line{display:flex}.settings-box .start{align-items:center;flex:auto}.settings-row{align-items:center;display:flex;flex-direction:row;max-width:100%;min-width:0}.no-outline{background:none;outline:none}[scrollable],iron-list,.list-item{--cr-icon-button-margin-end:0}.vertical-list>*:not(:first-of-type){border-top:var(--cr-separator-line)}.separator{border-inline-start:var(--cr-separator-line);flex-shrink:0;height:32px;margin:0 16px}.settings-box.no-padding>.link-wrapper~.separator{margin:0}.column-header{color:var(--cr-secondary-text-color);font-size:inherit;font-weight:400}.error-message{color:white;font-size:13px;padding-bottom:15px;padding-top:15px;text-align:center;white-space:normal}.url-directionality{direction:ltr;unicode-bidi:embed}.flex{flex:1}
    </style>
  </template>
`.content);
styleMod$7.register("settings-shared");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/prefs/prefs_mixin.js
/**
* @fileoverview Common prefs behavior.
*/
var PrefsMixin = dedupingMixin((superClass) => {
	class PrefsMixin extends superClass {
		static get properties() {
			return { 
			/** Preferences state. */
prefs: {
				type: Object,
				notify: true
			} };
		}
		/**
		* Gets the pref at the given prefPath. Throws if the pref is not found.
		*/
		getPref(prefPath) {
			const pref = this.get(prefPath, this.prefs);
			assert(typeof pref !== "undefined", "Pref is missing: " + prefPath);
			return pref;
		}
		/**
		* Sets the value of the pref at the given prefPath. Throws if the pref
		* is not found.
		*/
		setPrefValue(prefPath, value) {
			this.getPref(prefPath);
			this.set("prefs." + prefPath + ".value", value);
		}
		/**
		* Appends the item to the pref list at the given key if the item is not
		* already in the list. Asserts if the pref itself is not found or is
		* not an Array type.
		*/
		appendPrefListItem(key, item) {
			const pref = this.getPref(key);
			assert(pref && pref.type === chrome.settingsPrivate.PrefType.LIST);
			if (pref.value.indexOf(item) === -1) this.push("prefs." + key + ".value", item);
		}
		/**
		* Updates the item in the pref list to the new value. Asserts if the
		* pref itself is not found or is not an Array type.
		*/
		updatePrefListItem(key, item, newItem) {
			const pref = this.getPref(key);
			assert(pref && pref.type === chrome.settingsPrivate.PrefType.LIST);
			const index = pref.value.indexOf(item);
			if (index !== -1) this.set(`prefs.${key}.value.${index}`, newItem);
		}
		/**
		* Deletes the given item from the pref at the given key if the item is
		* found. Asserts if the pref itself is not found or is not an Array
		* type.
		*/
		deletePrefListItem(key, item) {
			assert(this.getPref(key).type === chrome.settingsPrivate.PrefType.LIST);
			const index = this.getPref(key).value.indexOf(item);
			if (index !== -1) this.splice(`prefs.${key}.value`, index, 1);
		}
		/**
		* Updates the entry in the pref dictionary to the new key value pair.
		* Asserts if the pref itself is not found or is not a dictionary type.
		*/
		setPrefDictEntry(prefPath, key, value) {
			const pref = this.getPref(prefPath);
			assert(pref && pref.type === chrome.settingsPrivate.PrefType.DICTIONARY);
			pref.value[key] = value;
			this.set("prefs." + prefPath + ".value", { ...pref.value });
		}
		/**
		* Deletes the given key from the pref dictionary if it is
		* found. Asserts if the pref itself is not found or is not a dictionary
		* type.
		*/
		deletePrefDictEntry(prefPath, key) {
			const pref = this.getPref(prefPath);
			assert(pref && pref.type === chrome.settingsPrivate.PrefType.DICTIONARY);
			delete pref.value[key];
			this.set("prefs." + prefPath + ".value", { ...pref.value });
		}
		/**
		* Helper to assign a pref as a computed property from a string
		* constant. Usage: computed: `computePref(prefs.${PREF_NAME})`,
		*/
		computePref(pref) {
			return pref;
		}
	}
	return PrefsMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/metrics_browser_proxy.js
/** @fileoverview Handles metrics for the settings pages. */
/**
* Contains all possible recorded interactions across privacy settings pages.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SettingsPrivacyElementInteractions enum in
* histograms/metadata/settings/enums.xml
*/
var PrivacyElementInteractions;
(function(PrivacyElementInteractions) {
	PrivacyElementInteractions[PrivacyElementInteractions["DO_NOT_TRACK"] = 2] = "DO_NOT_TRACK";
	PrivacyElementInteractions[PrivacyElementInteractions["PAYMENT_METHOD"] = 3] = "PAYMENT_METHOD";
	PrivacyElementInteractions[PrivacyElementInteractions["MANAGE_CERTIFICATES"] = 5] = "MANAGE_CERTIFICATES";
	PrivacyElementInteractions[PrivacyElementInteractions["IMPROVE_SECURITY"] = 8] = "IMPROVE_SECURITY";
	PrivacyElementInteractions[PrivacyElementInteractions["SITE_DETAILS_CLEAR_DATA"] = 19] = "SITE_DETAILS_CLEAR_DATA";
	PrivacyElementInteractions[PrivacyElementInteractions["THIRD_PARTY_COOKIES_ALLOW"] = 20] = "THIRD_PARTY_COOKIES_ALLOW";
	PrivacyElementInteractions[PrivacyElementInteractions["THIRD_PARTY_COOKIES_BLOCK_IN_INCOGNITO"] = 21] = "THIRD_PARTY_COOKIES_BLOCK_IN_INCOGNITO";
	PrivacyElementInteractions[PrivacyElementInteractions["THIRD_PARTY_COOKIES_BLOCK"] = 22] = "THIRD_PARTY_COOKIES_BLOCK";
	PrivacyElementInteractions[PrivacyElementInteractions["BLOCK_ALL_THIRD_PARTY_COOKIES"] = 23] = "BLOCK_ALL_THIRD_PARTY_COOKIES";
	PrivacyElementInteractions[PrivacyElementInteractions["MAX_VALUE"] = 26] = "MAX_VALUE";
})(PrivacyElementInteractions || (PrivacyElementInteractions = {}));
/**
* Contains all Safety Hub card states.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with SafetyHubCardState in
* histograms/enums.xml and CardState in safety_hub/safety_hub_browser_proxy.ts.
*/
var SafetyHubCardState;
(function(SafetyHubCardState) {
	SafetyHubCardState[SafetyHubCardState["WARNING"] = 0] = "WARNING";
	SafetyHubCardState[SafetyHubCardState["WEAK"] = 1] = "WEAK";
	SafetyHubCardState[SafetyHubCardState["INFO"] = 2] = "INFO";
	SafetyHubCardState[SafetyHubCardState["SAFE"] = 3] = "SAFE";
	SafetyHubCardState[SafetyHubCardState["MAX_VALUE"] = 4] = "MAX_VALUE";
})(SafetyHubCardState || (SafetyHubCardState = {}));
/**
* Contains all safety check notifications module interactions.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SafetyCheckNotificationsModuleInteractions enum
* in histograms/enums.xml
*/
var SafetyCheckNotificationsModuleInteractions;
(function(SafetyCheckNotificationsModuleInteractions) {
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["BLOCK"] = 0] = "BLOCK";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["BLOCK_ALL"] = 1] = "BLOCK_ALL";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["IGNORE"] = 2] = "IGNORE";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["MINIMIZE"] = 3] = "MINIMIZE";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["RESET"] = 4] = "RESET";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["UNDO_BLOCK"] = 5] = "UNDO_BLOCK";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["UNDO_IGNORE"] = 6] = "UNDO_IGNORE";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["UNDO_RESET"] = 7] = "UNDO_RESET";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["OPEN_REVIEW_UI"] = 8] = "OPEN_REVIEW_UI";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["UNDO_BLOCK_ALL"] = 9] = "UNDO_BLOCK_ALL";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["GO_TO_SETTINGS"] = 10] = "GO_TO_SETTINGS";
	SafetyCheckNotificationsModuleInteractions[SafetyCheckNotificationsModuleInteractions["MAX_VALUE"] = 11] = "MAX_VALUE";
})(SafetyCheckNotificationsModuleInteractions || (SafetyCheckNotificationsModuleInteractions = {}));
/**
* Contains all safety check unused site permissions module interactions.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the
* SafetyCheckUnusedSitePermissionsModuleInteractions enum in
* histograms/enums.xml
*/
var SafetyCheckUnusedSitePermissionsModuleInteractions;
(function(SafetyCheckUnusedSitePermissionsModuleInteractions) {
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["OPEN_REVIEW_UI"] = 0] = "OPEN_REVIEW_UI";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["ALLOW_AGAIN"] = 1] = "ALLOW_AGAIN";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["ACKNOWLEDGE_ALL"] = 2] = "ACKNOWLEDGE_ALL";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["UNDO_ALLOW_AGAIN"] = 3] = "UNDO_ALLOW_AGAIN";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["UNDO_ACKNOWLEDGE_ALL"] = 4] = "UNDO_ACKNOWLEDGE_ALL";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["MINIMIZE"] = 5] = "MINIMIZE";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["GO_TO_SETTINGS"] = 6] = "GO_TO_SETTINGS";
	SafetyCheckUnusedSitePermissionsModuleInteractions[SafetyCheckUnusedSitePermissionsModuleInteractions["MAX_VALUE"] = 7] = "MAX_VALUE";
})(SafetyCheckUnusedSitePermissionsModuleInteractions || (SafetyCheckUnusedSitePermissionsModuleInteractions = {}));
/**
* Contains all entry points for Safety Hub page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SafetyHubEntryPoint enum in
* histograms/enums.xml and safety_hub/safety_hub_constants.h.
*/
var SafetyHubEntryPoint;
(function(SafetyHubEntryPoint) {
	SafetyHubEntryPoint[SafetyHubEntryPoint["PRIVACY_SAFE"] = 0] = "PRIVACY_SAFE";
	SafetyHubEntryPoint[SafetyHubEntryPoint["PRIVACY_WARNING"] = 1] = "PRIVACY_WARNING";
	SafetyHubEntryPoint[SafetyHubEntryPoint["SITE_SETTINGS"] = 2] = "SITE_SETTINGS";
	SafetyHubEntryPoint[SafetyHubEntryPoint["THREE_DOT_MENU"] = 3] = "THREE_DOT_MENU";
	SafetyHubEntryPoint[SafetyHubEntryPoint["NOTIFICATIONS"] = 4] = "NOTIFICATIONS";
	SafetyHubEntryPoint[SafetyHubEntryPoint["MAX_VALUE"] = 5] = "MAX_VALUE";
})(SafetyHubEntryPoint || (SafetyHubEntryPoint = {}));
/**
* Contains all Safety Hub modules.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SafetyHubModuleType enum in
* histograms/enums.xml and safety_hub/safety_hub_constants.h.
*/
var SafetyHubModuleType;
(function(SafetyHubModuleType) {
	SafetyHubModuleType[SafetyHubModuleType["PERMISSIONS"] = 0] = "PERMISSIONS";
	SafetyHubModuleType[SafetyHubModuleType["NOTIFICATIONS"] = 1] = "NOTIFICATIONS";
	SafetyHubModuleType[SafetyHubModuleType["SAFE_BROWSING"] = 2] = "SAFE_BROWSING";
	SafetyHubModuleType[SafetyHubModuleType["EXTENSIONS"] = 3] = "EXTENSIONS";
	SafetyHubModuleType[SafetyHubModuleType["PASSWORDS"] = 4] = "PASSWORDS";
	SafetyHubModuleType[SafetyHubModuleType["VERSION"] = 5] = "VERSION";
	SafetyHubModuleType[SafetyHubModuleType["MAX_VALUE"] = 6] = "MAX_VALUE";
})(SafetyHubModuleType || (SafetyHubModuleType = {}));
/**
* Contains all safe browsing interactions.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the UserAction in safe_browsing_settings_metrics.h.
*/
var SafeBrowsingInteractions;
(function(SafeBrowsingInteractions) {
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_SHOWED"] = 0] = "SAFE_BROWSING_SHOWED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_ENHANCED_PROTECTION_CLICKED"] = 1] = "SAFE_BROWSING_ENHANCED_PROTECTION_CLICKED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_STANDARD_PROTECTION_CLICKED"] = 2] = "SAFE_BROWSING_STANDARD_PROTECTION_CLICKED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_DISABLE_SAFE_BROWSING_CLICKED"] = 3] = "SAFE_BROWSING_DISABLE_SAFE_BROWSING_CLICKED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_ENHANCED_PROTECTION_EXPAND_ARROW_CLICKED"] = 4] = "SAFE_BROWSING_ENHANCED_PROTECTION_EXPAND_ARROW_CLICKED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_STANDARD_PROTECTION_EXPAND_ARROW_CLICKED"] = 5] = "SAFE_BROWSING_STANDARD_PROTECTION_EXPAND_ARROW_CLICKED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_DISABLE_SAFE_BROWSING_DIALOG_CONFIRMED"] = 6] = "SAFE_BROWSING_DISABLE_SAFE_BROWSING_DIALOG_CONFIRMED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["SAFE_BROWSING_DISABLE_SAFE_BROWSING_DIALOG_DENIED"] = 7] = "SAFE_BROWSING_DISABLE_SAFE_BROWSING_DIALOG_DENIED";
	SafeBrowsingInteractions[SafeBrowsingInteractions["MAX_VALUE"] = 8] = "MAX_VALUE";
})(SafeBrowsingInteractions || (SafeBrowsingInteractions = {}));
/**
* All Privacy guide interactions with metrics.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with SettingsPrivacyGuideInteractions in emus.xml and
* PrivacyGuideInteractions in privacy_guide/privacy_guide.h.
*/
var PrivacyGuideInteractions;
(function(PrivacyGuideInteractions) {
	PrivacyGuideInteractions[PrivacyGuideInteractions["WELCOME_NEXT_BUTTON"] = 0] = "WELCOME_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["MSBB_NEXT_BUTTON"] = 1] = "MSBB_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["HISTORY_SYNC_NEXT_BUTTON"] = 2] = "HISTORY_SYNC_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["SAFE_BROWSING_NEXT_BUTTON"] = 3] = "SAFE_BROWSING_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["COOKIES_NEXT_BUTTON"] = 4] = "COOKIES_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["COMPLETION_NEXT_BUTTON"] = 5] = "COMPLETION_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["SETTINGS_LINK_ROW_ENTRY"] = 6] = "SETTINGS_LINK_ROW_ENTRY";
	PrivacyGuideInteractions[PrivacyGuideInteractions["PROMO_ENTRY"] = 7] = "PROMO_ENTRY";
	PrivacyGuideInteractions[PrivacyGuideInteractions["SWAA_COMPLETION_LINK"] = 8] = "SWAA_COMPLETION_LINK";
	PrivacyGuideInteractions[PrivacyGuideInteractions["PRIVACY_SANDBOX_COMPLETION_LINK"] = 9] = "PRIVACY_SANDBOX_COMPLETION_LINK";
	PrivacyGuideInteractions[PrivacyGuideInteractions["SEARCH_SUGGESTIONS_NEXT_BUTTON"] = 10] = "SEARCH_SUGGESTIONS_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["AD_TOPICS_NEXT_BUTTON"] = 12] = "AD_TOPICS_NEXT_BUTTON";
	PrivacyGuideInteractions[PrivacyGuideInteractions["AI_SETTINGS_COMPLETION_LINK"] = 13] = "AI_SETTINGS_COMPLETION_LINK";
	PrivacyGuideInteractions[PrivacyGuideInteractions["MAX_VALUE"] = 14] = "MAX_VALUE";
})(PrivacyGuideInteractions || (PrivacyGuideInteractions = {}));
/**
* This enum covers all possible combinations of the start and end
* settings states for each Privacy guide fragment, allowing metrics to see if
* users change their settings inside of Privacy guide or not. The format is
* settingAtStart-To-settingAtEnd.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with SettingsPrivacyGuideSettingsStates in enums.xml and
* PrivacyGuideSettingsStates in privacy_guide/privacy_guide.h.
*/
var PrivacyGuideSettingsStates;
(function(PrivacyGuideSettingsStates) {
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["MSBB_ON_TO_ON"] = 0] = "MSBB_ON_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["MSBB_ON_TO_OFF"] = 1] = "MSBB_ON_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["MSBB_OFF_TO_ON"] = 2] = "MSBB_OFF_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["MSBB_OFF_TO_OFF"] = 3] = "MSBB_OFF_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["BLOCK_3P_INCOGNITO_TO_3P_INCOGNITO"] = 4] = "BLOCK_3P_INCOGNITO_TO_3P_INCOGNITO";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["BLOCK_3P_INCOGNITO_TO_3P"] = 5] = "BLOCK_3P_INCOGNITO_TO_3P";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["BLOCK_3P_TO_3P_INCOGNITO"] = 6] = "BLOCK_3P_TO_3P_INCOGNITO";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["BLOCK_3P_TO_3P"] = 7] = "BLOCK_3P_TO_3P";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["HISTORY_SYNC_ON_TO_ON"] = 8] = "HISTORY_SYNC_ON_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["HISTORY_SYNC_ON_TO_OFF"] = 9] = "HISTORY_SYNC_ON_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["HISTORY_SYNC_OFF_TO_ON"] = 10] = "HISTORY_SYNC_OFF_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["HISTORY_SYNC_OFF_TO_OFF"] = 11] = "HISTORY_SYNC_OFF_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SAFE_BROWSING_ENHANCED_TO_ENHANCED"] = 12] = "SAFE_BROWSING_ENHANCED_TO_ENHANCED";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SAFE_BROWSING_ENHANCED_TO_STANDARD"] = 13] = "SAFE_BROWSING_ENHANCED_TO_STANDARD";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SAFE_BROWSING_STANDARD_TO_ENHANCED"] = 14] = "SAFE_BROWSING_STANDARD_TO_ENHANCED";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SAFE_BROWSING_STANDARD_TO_STANDARD"] = 15] = "SAFE_BROWSING_STANDARD_TO_STANDARD";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SEARCH_SUGGESTIONS_ON_TO_ON"] = 16] = "SEARCH_SUGGESTIONS_ON_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SEARCH_SUGGESTIONS_ON_TO_OFF"] = 17] = "SEARCH_SUGGESTIONS_ON_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SEARCH_SUGGESTIONS_OFF_TO_ON"] = 18] = "SEARCH_SUGGESTIONS_OFF_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["SEARCH_SUGGESTIONS_OFF_TO_OFF"] = 19] = "SEARCH_SUGGESTIONS_OFF_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["AD_TOPICS_ON_TO_ON"] = 20] = "AD_TOPICS_ON_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["AD_TOPICS_ON_TO_OFF"] = 21] = "AD_TOPICS_ON_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["AD_TOPICS_OFF_TO_ON"] = 22] = "AD_TOPICS_OFF_TO_ON";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["AD_TOPICS_OFF_TO_OFF"] = 23] = "AD_TOPICS_OFF_TO_OFF";
	PrivacyGuideSettingsStates[PrivacyGuideSettingsStates["MAX_VALUE"] = 24] = "MAX_VALUE";
})(PrivacyGuideSettingsStates || (PrivacyGuideSettingsStates = {}));
/**
* This enum is used with metrics to record when a step in the privacy guide is
* eligible to be shown and/or reached by the user.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with SettingsPrivacyGuideStepsEligibleAndReached in
* enums.xml and PrivacyGuideStepsEligibleAndReached in
* privacy_guide/privacy_guide.h.
*/
var PrivacyGuideStepsEligibleAndReached;
(function(PrivacyGuideStepsEligibleAndReached) {
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["MSBB_ELIGIBLE"] = 0] = "MSBB_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["MSBB_REACHED"] = 1] = "MSBB_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["HISTORY_SYNC_ELIGIBLE"] = 2] = "HISTORY_SYNC_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["HISTORY_SYNC_REACHED"] = 3] = "HISTORY_SYNC_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["SAFE_BROWSING_ELIGIBLE"] = 4] = "SAFE_BROWSING_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["SAFE_BROWSING_REACHED"] = 5] = "SAFE_BROWSING_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["COOKIES_ELIGIBLE"] = 6] = "COOKIES_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["COOKIES_REACHED"] = 7] = "COOKIES_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["COMPLETION_ELIGIBLE"] = 8] = "COMPLETION_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["COMPLETION_REACHED"] = 9] = "COMPLETION_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["SEARCH_SUGGESTIONS_ELIGIBLE"] = 10] = "SEARCH_SUGGESTIONS_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["SEARCH_SUGGESTIONS_REACHED"] = 11] = "SEARCH_SUGGESTIONS_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["AD_TOPICS_ELIGIBLE"] = 12] = "AD_TOPICS_ELIGIBLE";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["AD_TOPICS_REACHED"] = 13] = "AD_TOPICS_REACHED";
	PrivacyGuideStepsEligibleAndReached[PrivacyGuideStepsEligibleAndReached["COUNT"] = 14] = "COUNT";
})(PrivacyGuideStepsEligibleAndReached || (PrivacyGuideStepsEligibleAndReached = {}));
/**
* Contains the possible delete browsing data action types.
* This should be kept in sync with the `DeleteBrowsingDataAction` enum in
* components/browsing_data/core/browsing_data_utils.h
*/
var DeleteBrowsingDataAction;
(function(DeleteBrowsingDataAction) {
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["CLEAR_BROWSING_DATA_DIALOG"] = 0] = "CLEAR_BROWSING_DATA_DIALOG";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["CLEAR_BROWSING_DATA_ON_EXIT"] = 1] = "CLEAR_BROWSING_DATA_ON_EXIT";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["INCOGNITO_CLOSE_TABS"] = 2] = "INCOGNITO_CLOSE_TABS";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["COOKIES_IN_USE_DIALOG"] = 3] = "COOKIES_IN_USE_DIALOG";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["SITES_SETTINGS_PAGE"] = 4] = "SITES_SETTINGS_PAGE";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["HISTORY_PAGE_ENTRIES"] = 5] = "HISTORY_PAGE_ENTRIES";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["QUICK_DELETE"] = 6] = "QUICK_DELETE";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["PAGE_INFO_RESET_PERMISSIONS"] = 7] = "PAGE_INFO_RESET_PERMISSIONS";
	DeleteBrowsingDataAction[DeleteBrowsingDataAction["MAX_VALUE"] = 8] = "MAX_VALUE";
})(DeleteBrowsingDataAction || (DeleteBrowsingDataAction = {}));
/**
* This enum contains the different surfaces of Safety Hub that users can
* interact with, or on which they can observe a Safety Hub feature.
*
* Must be kept in sync with the `safety_hub::SafetyHubSurfaces` enum in
* chrome/browser/ui/safety_hub/safety_hub_constants.h and `SafetyHubSurfaces`
* in enums.xml
*/
var SafetyHubSurfaces;
(function(SafetyHubSurfaces) {
	SafetyHubSurfaces[SafetyHubSurfaces["THREE_DOT_MENU"] = 0] = "THREE_DOT_MENU";
	SafetyHubSurfaces[SafetyHubSurfaces["SAFETY_HUB_PAGE"] = 1] = "SAFETY_HUB_PAGE";
	SafetyHubSurfaces[SafetyHubSurfaces["MAX_VALUE"] = 2] = "MAX_VALUE";
})(SafetyHubSurfaces || (SafetyHubSurfaces = {}));
/**
* This enum contains the possible user actions for the bulk CVC deletion
* operation on the payments settings page.
*/
var CvcDeletionUserAction;
(function(CvcDeletionUserAction) {
	CvcDeletionUserAction["HYPERLINK_CLICKED"] = "BulkCvcDeletionHyperlinkClicked";
	CvcDeletionUserAction["DIALOG_ACCEPTED"] = "BulkCvcDeletionConfirmationDialogAccepted";
	CvcDeletionUserAction["DIALOG_CANCELLED"] = "BulkCvcDeletionConfirmationDialogCancelled";
})(CvcDeletionUserAction || (CvcDeletionUserAction = {}));
/**
* This enum contains relevant UserAction log names for card benefits-related
* functionality on the payment methods settings page.
*/
var CardBenefitsUserAction;
(function(CardBenefitsUserAction) {
	CardBenefitsUserAction["CARD_BENEFITS_TERMS_LINK_CLICKED"] = "CardBenefits_TermsLinkClicked";
})(CardBenefitsUserAction || (CardBenefitsUserAction = {}));
/**
* Contains all recorded interactions across AI settings page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SettingsAiPageInteractions enum in
* histograms/metadata/settings/enums.xml
*/
var AiPageInteractions;
(function(AiPageInteractions) {
	AiPageInteractions[AiPageInteractions["HISTORY_SEARCH_CLICK"] = 0] = "HISTORY_SEARCH_CLICK";
	AiPageInteractions[AiPageInteractions["COMPOSE_CLICK"] = 2] = "COMPOSE_CLICK";
	AiPageInteractions[AiPageInteractions["TAB_ORGANIZATION_CLICK"] = 3] = "TAB_ORGANIZATION_CLICK";
	AiPageInteractions[AiPageInteractions["AUTOFILL_AI_CLICK"] = 5] = "AUTOFILL_AI_CLICK";
	AiPageInteractions[AiPageInteractions["PASSWORD_CHANGE_CLICK"] = 6] = "PASSWORD_CHANGE_CLICK";
	AiPageInteractions[AiPageInteractions["MAX_VALUE"] = 7] = "MAX_VALUE";
})(AiPageInteractions || (AiPageInteractions = {}));
/**
* Contains all recorded interactions in the AI History Search settings page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SettingsAiPageHistorySearchInteractions enum in
* histograms/metadata/settings/enums.xml
*/
var AiPageHistorySearchInteractions;
(function(AiPageHistorySearchInteractions) {
	AiPageHistorySearchInteractions[AiPageHistorySearchInteractions["HISTORY_SEARCH_ENABLED"] = 0] = "HISTORY_SEARCH_ENABLED";
	AiPageHistorySearchInteractions[AiPageHistorySearchInteractions["HISTORY_SEARCH_DISABLED"] = 1] = "HISTORY_SEARCH_DISABLED";
	AiPageHistorySearchInteractions[AiPageHistorySearchInteractions["FEATURE_LINK_CLICKED"] = 2] = "FEATURE_LINK_CLICKED";
	AiPageHistorySearchInteractions[AiPageHistorySearchInteractions["LEARN_MORE_LINK_CLICKED"] = 3] = "LEARN_MORE_LINK_CLICKED";
	AiPageHistorySearchInteractions[AiPageHistorySearchInteractions["MAX_VALUE"] = 4] = "MAX_VALUE";
})(AiPageHistorySearchInteractions || (AiPageHistorySearchInteractions = {}));
/**
* Contains all recorded interactions in the AI Compose settings page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SettingsAiPageComposeInteractions enum in
* histograms/metadata/settings/enums.xml
*/
var AiPageComposeInteractions;
(function(AiPageComposeInteractions) {
	AiPageComposeInteractions[AiPageComposeInteractions["LEARN_MORE_LINK_CLICKED"] = 0] = "LEARN_MORE_LINK_CLICKED";
	AiPageComposeInteractions[AiPageComposeInteractions["COMPOSE_PROACTIVE_NUDGE_ENABLED"] = 1] = "COMPOSE_PROACTIVE_NUDGE_ENABLED";
	AiPageComposeInteractions[AiPageComposeInteractions["COMPOSE_PROACTIVE_NUDGE_DISABLED"] = 2] = "COMPOSE_PROACTIVE_NUDGE_DISABLED";
	AiPageComposeInteractions[AiPageComposeInteractions["MAX_VALUE"] = 3] = "MAX_VALUE";
})(AiPageComposeInteractions || (AiPageComposeInteractions = {}));
/**
* Contains all recorded interactions in the AI Tab Organization settings page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SettingsAiPageTabOrganizationInteractions enum
* in histograms/metadata/settings/enums.xml
*/
var AiPageTabOrganizationInteractions;
(function(AiPageTabOrganizationInteractions) {
	AiPageTabOrganizationInteractions[AiPageTabOrganizationInteractions["LEARN_MORE_LINK_CLICKED"] = 0] = "LEARN_MORE_LINK_CLICKED";
	AiPageTabOrganizationInteractions[AiPageTabOrganizationInteractions["MAX_VALUE"] = 1] = "MAX_VALUE";
})(AiPageTabOrganizationInteractions || (AiPageTabOrganizationInteractions = {}));
/**
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the AutofillSettingsReferrer enum in
* histograms/metadata/autofill/enums.xml
*/
var AutofillSettingsReferrer;
(function(AutofillSettingsReferrer) {
	AutofillSettingsReferrer[AutofillSettingsReferrer["SETTINGS_MENU"] = 1] = "SETTINGS_MENU";
	AutofillSettingsReferrer[AutofillSettingsReferrer["AUTOFILL_AND_PASSWORDS_PAGE"] = 2] = "AUTOFILL_AND_PASSWORDS_PAGE";
	AutofillSettingsReferrer[AutofillSettingsReferrer["MAX_VALUE"] = 4] = "MAX_VALUE";
})(AutofillSettingsReferrer || (AutofillSettingsReferrer = {}));
/**
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the YourSavedInfoDataCategory enum in
* histograms/metadata/autofill/enums.xml
*/
var YourSavedInfoDataCategory;
(function(YourSavedInfoDataCategory) {
	YourSavedInfoDataCategory[YourSavedInfoDataCategory["PASSWORD_MANAGER"] = 0] = "PASSWORD_MANAGER";
	YourSavedInfoDataCategory[YourSavedInfoDataCategory["PAYMENTS"] = 1] = "PAYMENTS";
	YourSavedInfoDataCategory[YourSavedInfoDataCategory["CONTACT_INFO"] = 2] = "CONTACT_INFO";
	YourSavedInfoDataCategory[YourSavedInfoDataCategory["IDENTITY_DOCS"] = 3] = "IDENTITY_DOCS";
	YourSavedInfoDataCategory[YourSavedInfoDataCategory["TRAVEL"] = 4] = "TRAVEL";
	YourSavedInfoDataCategory[YourSavedInfoDataCategory["MAX_VALUE"] = 5] = "MAX_VALUE";
})(YourSavedInfoDataCategory || (YourSavedInfoDataCategory = {}));
/**
* A specific kind of saved user's information.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the YourSavedInfoDataChip enum in
* histograms/metadata/autofill/enums.xml
*/
var YourSavedInfoDataChip;
(function(YourSavedInfoDataChip) {
	YourSavedInfoDataChip[YourSavedInfoDataChip["PASSWORDS"] = 0] = "PASSWORDS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["PASSKEYS"] = 1] = "PASSKEYS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["CREDIT_CARDS"] = 2] = "CREDIT_CARDS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["PAY_OVER_TIME"] = 3] = "PAY_OVER_TIME";
	YourSavedInfoDataChip[YourSavedInfoDataChip["IBANS"] = 4] = "IBANS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["LOYALTY_CARDS"] = 5] = "LOYALTY_CARDS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["ADDRESSES"] = 6] = "ADDRESSES";
	YourSavedInfoDataChip[YourSavedInfoDataChip["DRIVERS_LICENSES"] = 7] = "DRIVERS_LICENSES";
	YourSavedInfoDataChip[YourSavedInfoDataChip["NATIONAL_ID_CARDS"] = 8] = "NATIONAL_ID_CARDS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["PASSPORTS"] = 9] = "PASSPORTS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["FLIGHT_RESERVATIONS"] = 10] = "FLIGHT_RESERVATIONS";
	YourSavedInfoDataChip[YourSavedInfoDataChip["TRAVEL_INFO"] = 11] = "TRAVEL_INFO";
	YourSavedInfoDataChip[YourSavedInfoDataChip["VEHICLES"] = 12] = "VEHICLES";
	YourSavedInfoDataChip[YourSavedInfoDataChip["MAX_VALUE"] = 13] = "MAX_VALUE";
})(YourSavedInfoDataChip || (YourSavedInfoDataChip = {}));
/**
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the YourSavedInfoDataCategory enum in
* histograms/metadata/autofill/enums.xml
*/
var YourSavedInfoRelatedService;
(function(YourSavedInfoRelatedService) {
	YourSavedInfoRelatedService[YourSavedInfoRelatedService["GOOGLE_PASSWORD_MANAGER"] = 0] = "GOOGLE_PASSWORD_MANAGER";
	YourSavedInfoRelatedService[YourSavedInfoRelatedService["GOOGLE_WALLET"] = 1] = "GOOGLE_WALLET";
	YourSavedInfoRelatedService[YourSavedInfoRelatedService["GOOGLE_ACCOUNT"] = 2] = "GOOGLE_ACCOUNT";
	YourSavedInfoRelatedService[YourSavedInfoRelatedService["MAX_VALUE"] = 3] = "MAX_VALUE";
})(YourSavedInfoRelatedService || (YourSavedInfoRelatedService = {}));
var MetricsBrowserProxyImpl = class MetricsBrowserProxyImpl {
	recordAction(action) {
		chrome.send("metricsHandler:recordAction", [action]);
	}
	recordBooleanHistogram(histogramName, visible) {
		chrome.send("metricsHandler:recordBooleanHistogram", [histogramName, visible]);
	}
	recordSafetyHubCardStateClicked(histogramName, state) {
		chrome.send("metricsHandler:recordInHistogram", [
			histogramName,
			state,
			SafetyHubCardState.MAX_VALUE
		]);
	}
	recordSafetyHubEntryPointShown(page) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.EntryPointImpression",
			page,
			SafetyHubEntryPoint.MAX_VALUE
		]);
	}
	recordSafetyHubEntryPointClicked(page) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.EntryPointInteraction",
			page,
			SafetyHubEntryPoint.MAX_VALUE
		]);
	}
	recordSafetyHubModuleWarningImpression(module) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.DashboardWarning",
			module,
			SafetyHubModuleType.MAX_VALUE
		]);
	}
	recordSafetyHubDashboardAnyWarning(visible) {
		chrome.send("metricsHandler:recordBooleanHistogram", ["Settings.SafetyHub.HasDashboardShowAnyWarning", visible]);
	}
	recordSafetyHubNotificationPermissionsModuleInteractionsHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.NotificationPermissionsModule.Interactions",
			interaction,
			SafetyCheckNotificationsModuleInteractions.MAX_VALUE
		]);
	}
	recordSafetyHubNotificationPermissionsModuleListCountHistogram(suggestions) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.NotificationPermissionsModule.ListCount",
			suggestions,
			99
		]);
	}
	recordSafetyHubUnusedSitePermissionsModuleInteractionsHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.UnusedSitePermissionsModule.Interactions",
			interaction,
			SafetyCheckUnusedSitePermissionsModuleInteractions.MAX_VALUE
		]);
	}
	recordSafetyHubAbusiveNotificationPermissionRevocationInteractionsHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.AbusiveNotificationPermissionRevocation.Interactions",
			interaction,
			SafetyCheckUnusedSitePermissionsModuleInteractions.MAX_VALUE
		]);
	}
	recordSafetyHubUnusedSitePermissionsModuleListCountHistogram(suggestions) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.UnusedSitePermissionsModule.ListCount",
			suggestions,
			99
		]);
	}
	recordSettingsPageHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.PrivacyElementInteractions",
			interaction,
			PrivacyElementInteractions.MAX_VALUE
		]);
	}
	recordSafeBrowsingInteractionHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"SafeBrowsing.Settings.UserAction.Default",
			interaction,
			SafeBrowsingInteractions.MAX_VALUE
		]);
	}
	recordPrivacyGuideNextNavigationHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.PrivacyGuide.NextNavigation",
			interaction,
			PrivacyGuideInteractions.MAX_VALUE
		]);
	}
	recordPrivacyGuideEntryExitHistogram(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.PrivacyGuide.EntryExit",
			interaction,
			PrivacyGuideInteractions.MAX_VALUE
		]);
	}
	recordPrivacyGuideSettingsStatesHistogram(state) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.PrivacyGuide.SettingsStates",
			state,
			PrivacyGuideSettingsStates.MAX_VALUE
		]);
	}
	recordPrivacyGuideFlowLengthHistogram(steps) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.PrivacyGuide.FlowLength",
			steps,
			5
		]);
	}
	recordPrivacyGuideStepsEligibleAndReachedHistogram(status) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.PrivacyGuide.StepsEligibleAndReached",
			status,
			PrivacyGuideStepsEligibleAndReached.COUNT
		]);
	}
	recordDeleteBrowsingDataAction(action) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Privacy.DeleteBrowsingData.Action",
			action,
			DeleteBrowsingDataAction.MAX_VALUE
		]);
	}
	recordSafetyHubImpression(surface) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.Impression",
			surface,
			SafetyHubSurfaces.MAX_VALUE
		]);
	}
	recordSafetyHubInteraction(surface) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.SafetyHub.Interaction",
			surface,
			SafetyHubSurfaces.MAX_VALUE
		]);
	}
	recordAiPageInteractions(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.AiPage.Interactions",
			interaction,
			AiPageInteractions.MAX_VALUE
		]);
	}
	recordAiPageHistorySearchInteractions(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.AiPage.HistorySearch.Interactions",
			interaction,
			AiPageHistorySearchInteractions.MAX_VALUE
		]);
	}
	recordAiPageComposeInteractions(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.AiPage.Compose.Interactions",
			interaction,
			AiPageComposeInteractions.MAX_VALUE
		]);
	}
	recordAiPageTabOrganizationInteractions(interaction) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.AiPage.TabOrganization.Interactions",
			interaction,
			AiPageTabOrganizationInteractions.MAX_VALUE
		]);
	}
	recordAutofillSettingsReferrer(histogramName, referrer) {
		chrome.send("metricsHandler:recordInHistogram", [
			histogramName,
			referrer,
			AutofillSettingsReferrer.MAX_VALUE
		]);
	}
	recordYourSavedInfoCategoryClick(category) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Autofill.YourSavedInfoSettingsPage.CategoryLinkClick",
			category,
			YourSavedInfoDataCategory.MAX_VALUE
		]);
		if (category !== YourSavedInfoDataCategory.MAX_VALUE) this.recordAction(`Settings.YourSavedInfo.CategoryClick.${YourSavedInfoDataCategory[category]}`);
	}
	recordYourSavedInfoDataChipClick(chip) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Autofill.YourSavedInfoSettingsPage.DataChipClick",
			chip,
			YourSavedInfoDataChip.MAX_VALUE
		]);
		if (chip !== YourSavedInfoDataChip.MAX_VALUE) this.recordAction(`Settings.YourSavedInfo.ChipClick.${YourSavedInfoDataChip[chip]}`);
	}
	recordYourSavedInfoRelatedServiceClick(service) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Autofill.YourSavedInfoSettingsPage.RelatedServiceLinkClick",
			service,
			YourSavedInfoRelatedService.MAX_VALUE
		]);
		if (service !== YourSavedInfoRelatedService.MAX_VALUE) this.recordAction(`Settings.YourSavedInfo.RelatedServiceClick.${YourSavedInfoRelatedService[service]}`);
	}
	static getInstance() {
		return instance$29 || (instance$29 = new MetricsBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$29 = obj;
	}
};
var instance$29 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/page_visibility.js
function createPageVisibility() {
	if (!loadTimeData$2.getBoolean("isGuest")) return;
	return {
		a11y: false,
		ai: false,
		appearance: false,
		autofill: false,
		defaultBrowser: false,
		downloads: false,
		extensions: false,
		languages: false,
		onStartup: false,
		people: false,
		performance: false,
		privacy: false,
		reset: false,
		safetyHub: false,
		system: false,
		yourSavedInfo: false
	};
}
/**
* Dictionary defining page visibility.
*/
var pageVisibility = createPageVisibility();
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/router.js
/** Class for navigable routes. */
var Route = class Route {
	path;
	parent = null;
	depth = 0;
	title;
	/**
	* Whether this route corresponds to a navigable dialog. Those routes must
	* belong to a "section".
	*/
	isNavigableDialog = false;
	section = "";
	constructor(path, title) {
		this.path = path;
		this.title = title;
	}
	/**
	* Returns a new Route instance that's a child of this route.
	* @param path Extends this route's path if it doesn't contain a
	*     leading slash.
	*/
	createChild(path, title) {
		assert(path);
		const newUrl = path[0] === "/" ? path : `${this.path}/${path}`;
		const route = new Route(newUrl, title);
		route.parent = this;
		route.section = this.section;
		route.depth = this.depth + 1;
		return route;
	}
	/**
	* Returns a new Route instance that's a child section of this route.
	* TODO(tommycli): Remove once we've obsoleted the concept of sections.
	*/
	createSection(path, section, title) {
		const route = this.createChild(path, title);
		route.section = section;
		return route;
	}
	/**
	* Returns the absolute path string for this Route, assuming this function
	* has been called from within astro://settings.
	*/
	getAbsolutePath() {
		return window.location.origin + this.path;
	}
	/**
	* Returns true if this route matches or is an ancestor of the parameter.
	*/
	contains(route) {
		for (let r = route; r != null; r = r.parent) if (this === r) return true;
		return false;
	}
	/**
	* Returns true if this route is a subpage of a section.
	*/
	isSubpage() {
		return !this.isNavigableDialog && !!this.parent && !!this.section && this.parent.section === this.section;
	}
};
/**
* Regular expression that captures the leading slash, the content and the
* trailing slash in three different groups.
*/
var CANONICAL_PATH_REGEX = /(^\/)([\/-\w]+)(\/$)/;
var routerInstance = null;
var Router = class {
	/**
	* List of available routes. This is populated taking into account current
	* state (like guest mode).
	*/
	routes_;
	/**
	* The current active route. This updated is only by settings.navigateTo
	* or settings.initializeRouteFromUrl.
	*/
	currentRoute;
	/**
	* The current query parameters. This is updated only by
	* settings.navigateTo or settings.initializeRouteFromUrl.
	*/
	currentQueryParameters_ = new URLSearchParams();
	wasLastRouteChangePopstate_ = false;
	initializeRouteFromUrlCalled_ = false;
	routeObservers_ = /* @__PURE__ */ new Set();
	/** @return The singleton instance. */
	static getInstance() {
		assert(routerInstance);
		return routerInstance;
	}
	static setInstance(instance) {
		assert(!routerInstance);
		routerInstance = instance;
	}
	static resetInstanceForTesting(instance) {
		if (routerInstance) instance.routeObservers_ = routerInstance.routeObservers_;
		routerInstance = instance;
	}
	constructor(availableRoutes) {
		this.routes_ = availableRoutes;
		this.currentRoute = this.routes_.BASIC;
	}
	addObserver(observer) {
		assert(!this.routeObservers_.has(observer));
		this.routeObservers_.add(observer);
	}
	removeObserver(observer) {
		assert(this.routeObservers_.delete(observer));
	}
	getRoute(routeName) {
		return this.routeDictionary_()[routeName];
	}
	getRoutes() {
		return this.routes_;
	}
	/**
	* Helper function to set the current route and notify all observers.
	*/
	setCurrentRoute(route, queryParameters, isPopstate) {
		this.recordMetrics(route.path);
		const oldRoute = this.currentRoute;
		this.currentRoute = route;
		this.currentQueryParameters_ = queryParameters;
		this.wasLastRouteChangePopstate_ = isPopstate;
		new Set(this.routeObservers_).forEach((observer) => {
			observer.currentRouteChanged(this.currentRoute, oldRoute);
		});
		this.updateTitle_();
	}
	/**
	* Updates the page title to reflect the current route.
	*/
	updateTitle_() {
		if (this.currentRoute.title) document.title = loadTimeData$2.getStringF("settingsAltPageTitle", this.currentRoute.title);
		else if (this.currentRoute.isNavigableDialog && this.currentRoute.parent && this.currentRoute.parent.title) document.title = loadTimeData$2.getStringF("settingsAltPageTitle", this.currentRoute.parent.title);
		else if (!this.currentRoute.isSubpage() && !this.routes_.ABOUT.contains(this.currentRoute)) document.title = loadTimeData$2.getString("settings");
	}
	getCurrentRoute() {
		return this.currentRoute;
	}
	getQueryParameters() {
		return new URLSearchParams(this.currentQueryParameters_);
	}
	lastRouteChangeWasPopstate() {
		return this.wasLastRouteChangePopstate_;
	}
	routeDictionary_() {
		return this.routes_;
	}
	/**
	* @return The matching canonical route, or null if none matches.
	*/
	getRouteForPath(path) {
		const canonicalPath = path.replace(CANONICAL_PATH_REGEX, "$1$2");
		const matchingKey = Object.keys(this.routes_).find((key) => this.routeDictionary_()[key].path === canonicalPath);
		return matchingKey ? this.routeDictionary_()[matchingKey] : null;
	}
	/**
	* Updates the URL parameters of the current route via exchanging the
	* window history state. This changes the Settings route path, but doesn't
	* change the route itself, hence does not push a new route history entry.
	* Notifies routeChangedObservers.
	*/
	updateRouteParams(params) {
		let url = this.currentRoute.path;
		const queryString = params.toString();
		if (queryString) url += "?" + queryString;
		window.history.replaceState(window.history.state, "", url);
		this.currentQueryParameters_ = params;
		new Set(this.routeObservers_).forEach((observer) => {
			observer.currentRouteChanged(this.currentRoute, this.currentRoute);
		});
	}
	/**
	* Navigates to a canonical route and pushes a new history entry.
	* @param dynamicParameters Navigations to the same
	*     URL parameters in a different order will still push to history.
	* @param removeSearch Whether to strip the 'search' URL
	*     parameter during navigation. Defaults to false.
	*/
	navigateTo(route, dynamicParameters, removeSearch = false) {
		if (route === this.routes_.ADVANCED) route = this.routes_.BASIC;
		const params = dynamicParameters || new URLSearchParams();
		const oldSearchParam = this.getQueryParameters().get("search") || "";
		const newSearchParam = params.get("search") || "";
		if (!removeSearch && oldSearchParam && !newSearchParam) params.append("search", oldSearchParam);
		let url = route.path;
		const queryString = params.toString();
		if (queryString) url += "?" + queryString;
		window.history.pushState(this.currentRoute.path, "", url);
		this.setCurrentRoute(route, params, false);
	}
	/**
	* Navigates to the previous route if it has an equal or lesser depth.
	* If there is no previous route in history meeting those requirements,
	* this navigates to the immediate parent. This will never exit Settings.
	*/
	navigateToPreviousRoute() {
		let previousRoute = null;
		if (window.history.state) {
			previousRoute = this.getRouteForPath(window.history.state);
			assert(previousRoute);
		}
		if (previousRoute && previousRoute.depth <= this.currentRoute.depth) window.history.back();
		else this.navigateTo(this.currentRoute.parent || this.routes_.BASIC);
	}
	/**
	* Initialize the route and query params from the URL.
	*/
	initializeRouteFromUrl() {
		assert(!this.initializeRouteFromUrlCalled_);
		this.initializeRouteFromUrlCalled_ = true;
		const route = this.getRouteForPath(window.location.pathname);
		this.recordMetrics(route ? route.path : this.routes_.BASIC.path);
		if (route && route !== this.routes_.ADVANCED) {
			this.currentRoute = route;
			this.currentQueryParameters_ = new URLSearchParams(window.location.search);
		} else window.history.replaceState(void 0, "", this.routes_.BASIC.path);
		this.updateTitle_();
	}
	/**
	* Make a UMA note about visiting this URL path.
	* @param urlPath The url path (only).
	*/
	recordMetrics(urlPath) {
		assert(!urlPath.startsWith("astro://"));
		assert(!urlPath.startsWith("settings"));
		assert(urlPath.startsWith("/"));
		assert(!urlPath.match(/\?/g));
		chrome.metricsPrivate.recordSparseValueWithPersistentHash("WebUI.Settings.PathVisited", urlPath);
	}
	resetRouteForTesting() {
		this.initializeRouteFromUrlCalled_ = false;
		this.wasLastRouteChangePopstate_ = false;
		this.currentRoute = this.routes_.BASIC;
		this.currentQueryParameters_ = new URLSearchParams();
	}
};
var RouteObserverMixin = dedupingMixin((superClass) => {
	class RouteObserverMixin extends superClass {
		connectedCallback() {
			super.connectedCallback();
			assert(routerInstance);
			routerInstance.addObserver(this);
			this.currentRouteChanged(routerInstance.currentRoute, void 0);
		}
		disconnectedCallback() {
			super.disconnectedCallback();
			assert(routerInstance);
			routerInstance.removeObserver(this);
		}
		currentRouteChanged(_newRoute, _oldRoute) {
			assertNotReached();
		}
	}
	return RouteObserverMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/route.js
/**
* Add all of the child routes that originate from the privacy route,
* regardless of whether the privacy section under basic or advanced.
*/
function addPrivacyChildRoutes(r) {
	assert(r.PRIVACY);
	r.CLEAR_BROWSER_DATA = r.PRIVACY.createChild("/clearBrowserData");
	r.CLEAR_BROWSER_DATA.isNavigableDialog = true;
	if ((pageVisibility || {}).safetyHub !== false) r.SAFETY_HUB = r.PRIVACY.createChild("/safetyCheck");
	if (loadTimeData$2.getBoolean("showPrivacyGuide")) r.PRIVACY_GUIDE = r.PRIVACY.createChild("guide");
	r.SITE_SETTINGS = r.PRIVACY.createChild("/content");
	r.SECURITY = r.PRIVACY.createChild("/security");
	r.COOKIES = r.PRIVACY.createChild("/cookies");
	if (!loadTimeData$2.getBoolean("isPrivacySandboxRestricted")) {
		r.PRIVACY_SANDBOX = r.PRIVACY.createChild("/adPrivacy");
		r.PRIVACY_SANDBOX_TOPICS = r.PRIVACY_SANDBOX.createChild("/adPrivacy/interests");
		r.PRIVACY_SANDBOX_MANAGE_TOPICS = r.PRIVACY_SANDBOX_TOPICS.createChild("/adPrivacy/interests/manage");
		r.PRIVACY_SANDBOX_FLEDGE = r.PRIVACY_SANDBOX.createChild("/adPrivacy/sites");
		r.PRIVACY_SANDBOX_AD_MEASUREMENT = r.PRIVACY_SANDBOX.createChild("/adPrivacy/measurement");
	} else if (loadTimeData$2.getBoolean("isPrivacySandboxRestrictedNoticeEnabled")) {
		r.PRIVACY_SANDBOX = r.PRIVACY.createChild("/adPrivacy");
		r.PRIVACY_SANDBOX_AD_MEASUREMENT = r.PRIVACY_SANDBOX.createChild("/adPrivacy/measurement");
	}
	if (loadTimeData$2.getBoolean("enableSecurityKeysSubpage")) r.SECURITY_KEYS = r.SECURITY.createChild("/securityKeys");
	r.SITE_SETTINGS_ALL = r.SITE_SETTINGS.createChild("all");
	r.SITE_SETTINGS_SITE_DETAILS = r.SITE_SETTINGS_ALL.createChild("/content/siteDetails");
	r.SITE_SETTINGS_HANDLERS = r.SITE_SETTINGS.createChild("/handlers");
	r.SITE_SETTINGS_ADS = r.SITE_SETTINGS.createChild("ads");
	r.SITE_SETTINGS_AR = r.SITE_SETTINGS.createChild("ar");
	r.SITE_SETTINGS_AUTOMATIC_DOWNLOADS = r.SITE_SETTINGS.createChild("automaticDownloads");
	r.SITE_SETTINGS_AUTO_PICTURE_IN_PICTURE = r.SITE_SETTINGS.createChild("autoPictureInPicture");
	if (loadTimeData$2.getBoolean("enableCapturedSurfaceControl")) r.SITE_SETTINGS_CAPTURED_SURFACE_CONTROL = r.SITE_SETTINGS.createChild("capturedSurfaceControl");
	r.SITE_SETTINGS_AUTO_VERIFY = r.SITE_SETTINGS.createChild("autoVerify");
	r.SITE_SETTINGS_BACKGROUND_SYNC = r.SITE_SETTINGS.createChild("backgroundSync");
	r.SITE_SETTINGS_CAMERA = r.SITE_SETTINGS.createChild("camera");
	r.SITE_SETTINGS_CLIPBOARD = r.SITE_SETTINGS.createChild("clipboard");
	if (loadTimeData$2.getBoolean("enableHandTrackingContentSetting")) r.SITE_SETTINGS_HAND_TRACKING = r.SITE_SETTINGS.createChild("handTracking");
	r.SITE_SETTINGS_IDLE_DETECTION = r.SITE_SETTINGS.createChild("idleDetection");
	r.SITE_SETTINGS_IMAGES = r.SITE_SETTINGS.createChild("images");
	r.SITE_SETTINGS_MIXEDSCRIPT = r.SITE_SETTINGS.createChild("insecureContent");
	r.SITE_SETTINGS_JAVASCRIPT = r.SITE_SETTINGS.createChild("javascript");
	r.SITE_SETTINGS_JAVASCRIPT_OPTIMIZER = r.SITE_SETTINGS.createChild("v8");
	if (loadTimeData$2.getBoolean("enableKeyboardLockPrompt")) r.SITE_SETTINGS_KEYBOARD_LOCK = r.SITE_SETTINGS.createChild("keyboardLock");
	r.SITE_SETTINGS_SOUND = r.SITE_SETTINGS.createChild("sound");
	r.SITE_SETTINGS_SENSORS = r.SITE_SETTINGS.createChild("sensors");
	r.SITE_SETTINGS_LOCATION = r.SITE_SETTINGS.createChild("location");
	r.SITE_SETTINGS_MICROPHONE = r.SITE_SETTINGS.createChild("microphone");
	r.SITE_SETTINGS_NOTIFICATIONS = r.SITE_SETTINGS.createChild("notifications");
	r.SITE_SETTINGS_POPUPS = r.SITE_SETTINGS.createChild("popups");
	r.SITE_SETTINGS_MIDI_DEVICES = r.SITE_SETTINGS.createChild("midiDevices");
	r.SITE_SETTINGS_USB_DEVICES = r.SITE_SETTINGS.createChild("usbDevices");
	r.SITE_SETTINGS_HID_DEVICES = r.SITE_SETTINGS.createChild("hidDevices");
	r.SITE_SETTINGS_SERIAL_PORTS = r.SITE_SETTINGS.createChild("serialPorts");
	if (loadTimeData$2.getBoolean("enableWebPrintingContentSetting")) r.SITE_SETTINGS_WEB_PRINTING = r.SITE_SETTINGS.createChild("webPrinting");
	if (loadTimeData$2.getBoolean("enableWebBluetoothNewPermissionsBackend")) r.SITE_SETTINGS_BLUETOOTH_DEVICES = r.SITE_SETTINGS.createChild("bluetoothDevices");
	r.SITE_SETTINGS_ZOOM_LEVELS = r.SITE_SETTINGS.createChild("zoomLevels");
	r.SITE_SETTINGS_PDF_DOCUMENTS = r.SITE_SETTINGS.createChild("pdfDocuments");
	r.SITE_SETTINGS_PROTECTED_CONTENT = r.SITE_SETTINGS.createChild("protectedContent");
	if (loadTimeData$2.getBoolean("enablePaymentHandlerContentSetting")) r.SITE_SETTINGS_PAYMENT_HANDLER = r.SITE_SETTINGS.createChild("paymentHandler");
	if (loadTimeData$2.getBoolean("enableFederatedIdentityApiContentSetting")) r.SITE_SETTINGS_FEDERATED_IDENTITY_API = r.SITE_SETTINGS.createChild("federatedIdentityApi");
	r.SITE_SETTINGS_SITE_DATA = r.SITE_SETTINGS.createChild("siteData");
	r.SITE_SETTINGS_VR = r.SITE_SETTINGS.createChild("vr");
	if (loadTimeData$2.getBoolean("enableExperimentalWebPlatformFeatures")) r.SITE_SETTINGS_BLUETOOTH_SCANNING = r.SITE_SETTINGS.createChild("bluetoothScanning");
	r.SITE_SETTINGS_WINDOW_MANAGEMENT = r.SITE_SETTINGS.createChild("windowManagement");
	r.SITE_SETTINGS_FILE_SYSTEM_WRITE = r.SITE_SETTINGS.createChild("filesystem");
	if (loadTimeData$2.getBoolean("enablePersistentPermissions")) r.SITE_SETTINGS_FILE_SYSTEM_WRITE_DETAILS = r.SITE_SETTINGS_FILE_SYSTEM_WRITE.createChild("siteDetails");
	r.SITE_SETTINGS_LOCAL_FONTS = r.SITE_SETTINGS.createChild("localFonts");
	r.SITE_SETTINGS_STORAGE_ACCESS = r.SITE_SETTINGS.createChild("storageAccess");
	r.SITE_SETTINGS_AUTOMATIC_FULLSCREEN = r.SITE_SETTINGS.createChild("automaticFullScreen");
	if (loadTimeData$2.getBoolean("enableWebAppInstallation")) r.SITE_SETTINGS_WEB_APP_INSTALLATION = r.SITE_SETTINGS.createChild("webApplications");
	if (loadTimeData$2.getBoolean("enableLocalNetworkAccessSetting")) r.SITE_SETTINGS_LOCAL_NETWORK_ACCESS = r.SITE_SETTINGS.createChild("localNetworkAccess");
	if (loadTimeData$2.getBoolean("enableLocalNetworkAccessSplitPermissions")) {
		r.SITE_SETTINGS_LOCAL_NETWORK = r.SITE_SETTINGS.createChild("localNetwork");
		r.SITE_SETTINGS_LOOPBACK_NETWORK = r.SITE_SETTINGS.createChild("loopbackNetwork");
	}
}
/**
* Adds Route objects for each path.
*/
function createRoutes() {
	const r = {};
	r.BASIC = new Route("/");
	r.ABOUT = r.BASIC.createSection("/help", "about", loadTimeData$2.getString("aboutPageTitle"));
	r.SEARCH = r.BASIC.createSection("/search", "search", loadTimeData$2.getString("searchPageTitle"));
	r.SEARCH_ENGINES = r.SEARCH.createChild("/searchEngines");
	const visibility = pageVisibility || {};
	if (visibility.people !== false) {
		r.PEOPLE = r.BASIC.createSection("/people", "people", loadTimeData$2.getString("peoplePageTitle"));
		r.SIGN_OUT = r.PEOPLE.createChild("/signOut");
		r.SIGN_OUT.isNavigableDialog = true;
		r.IMPORT_DATA = r.PEOPLE.createChild("/importData");
		r.IMPORT_DATA.isNavigableDialog = true;
		if (loadTimeData$2.getBoolean("replaceSyncPromosWithSignInPromos")) {
			r.ACCOUNT = r.PEOPLE.createChild("/account");
			r.GOOGLE_SERVICES = r.PEOPLE.createChild("/googleServices");
		}
		r.MANAGE_PROFILE = r.PEOPLE.createChild("/manageProfile");
		r.SYNC = r.PEOPLE.createChild("/syncSetup");
		r.SYNC_ADVANCED = r.SYNC.createChild("/syncSetup/advanced");
	}
	if (visibility.ai !== false && loadTimeData$2.getBoolean("showAiPage")) {
		r.AI = r.BASIC.createSection("/ai", "ai", loadTimeData$2.getString("aiInnovationsPageTitle"));
		if (loadTimeData$2.getBoolean("showTabOrganizationControl")) r.AI_TAB_ORGANIZATION = r.AI.createChild("/ai/tabOrganizer");
		if (loadTimeData$2.getBoolean("showHistorySearchControl")) r.HISTORY_SEARCH = r.AI.createChild("/ai/historySearch");
		if (loadTimeData$2.getBoolean("showComposeControl")) r.OFFER_WRITING_HELP = r.AI.createChild("/ai/helpMeWrite");
		if (loadTimeData$2.getBoolean("showCompareControl")) r.COMPARE = r.AI.createChild("/ai/compareProducts");
	}
	if (visibility.appearance !== false) {
		r.APPEARANCE = r.BASIC.createSection("/appearance", "appearance", loadTimeData$2.getString("appearancePageTitle"));
		r.FONTS = r.APPEARANCE.createChild("/fonts");
	}
	if (loadTimeData$2.getBoolean("enableYourSavedInfoSettingsPage")) {
		if (visibility.yourSavedInfo !== false) {
			r.YOUR_SAVED_INFO = r.BASIC.createSection("/autofill", "yourSavedInfo", loadTimeData$2.getString("autofillPageTitle"));
			r.PAYMENTS = r.YOUR_SAVED_INFO.createChild("/payments");
			r.YOUR_SAVED_INFO_CONTACT_INFO = r.YOUR_SAVED_INFO.createChild("/contactInfo");
			r.YOUR_SAVED_INFO_IDENTITY_DOCS = r.YOUR_SAVED_INFO.createChild("/identityDocs");
			r.YOUR_SAVED_INFO_TRAVEL = r.YOUR_SAVED_INFO.createChild("/travel");
		}
	} else if (visibility.autofill !== false) {
		r.AUTOFILL = r.BASIC.createSection("/autofill", "autofill", loadTimeData$2.getString("autofillPageTitle"));
		r.PAYMENTS = r.AUTOFILL.createChild("/payments");
		r.ADDRESSES = r.AUTOFILL.createChild("/addresses");
		if (loadTimeData$2.getBoolean("showAutofillAiControl")) r.AUTOFILL_AI = r.AUTOFILL.createChild("/enhancedAutofill");
	}
	if (visibility.privacy !== false) {
		r.PRIVACY = r.BASIC.createSection("/privacy", "privacy", loadTimeData$2.getString("privacyPageTitle"));
		addPrivacyChildRoutes(r);
	}
	if (visibility.defaultBrowser !== false) r.DEFAULT_BROWSER = r.BASIC.createSection("/defaultBrowser", "defaultBrowser", loadTimeData$2.getString("defaultBrowser"));
	if (visibility.onStartup !== false) r.ON_STARTUP = r.BASIC.createSection("/onStartup", "onStartup", loadTimeData$2.getString("onStartup"));
	r.ADVANCED = new Route("/advanced");
	if (visibility.languages !== false) {
		r.LANGUAGES = r.ADVANCED.createSection("/languages", "languages", loadTimeData$2.getString("languagesPageTitle"));
		r.SPELL_CHECK = r.LANGUAGES.createSection("/spellCheck", "languages");
		r.EDIT_DICTIONARY = r.SPELL_CHECK.createChild("/editDictionary");
	}
	if (visibility.downloads !== false) r.DOWNLOADS = r.ADVANCED.createSection("/downloads", "downloads", loadTimeData$2.getString("downloadsPageTitle"));
	if (visibility.a11y !== false) {
		r.ACCESSIBILITY = r.ADVANCED.createSection("/accessibility", "a11y", loadTimeData$2.getString("a11yPageTitle"));
		r.CAPTIONS = r.ACCESSIBILITY.createChild("/captions");
	}
	if (visibility.system !== false) r.SYSTEM = r.ADVANCED.createSection("/system", "system", loadTimeData$2.getString("systemPageTitle"));
	if (visibility.reset !== false) {
		r.RESET = r.ADVANCED.createSection("/reset", "reset", loadTimeData$2.getString("resetPageTitle"));
		r.RESET_DIALOG = r.RESET.createChild("/resetProfileSettings");
		r.RESET_DIALOG.isNavigableDialog = true;
		r.TRIGGERED_RESET_DIALOG = r.RESET.createChild("/triggeredResetProfileSettings");
		r.TRIGGERED_RESET_DIALOG.isNavigableDialog = true;
	}
	if (visibility.performance !== false) r.PERFORMANCE = r.BASIC.createSection("/performance", "performance", loadTimeData$2.getString("performancePageTitle"));
	return r;
}
/**
* @return A router with the browser settings routes.
*/
function buildRouter() {
	return new Router(createRoutes());
}
Router.setInstance(buildRouter());
window.addEventListener("popstate", function() {
	const routerInstance = Router.getInstance();
	routerInstance.setCurrentRoute(routerInstance.getRouteForPath(window.location.pathname) || routerInstance.getRoutes().BASIC, new URLSearchParams(window.location.search), true);
});
var routes = Router.getInstance().getRoutes();
function getTopLevelRoute() {
	if (!loadTimeData$2.getBoolean("isGuest")) return routes.PEOPLE;
	return routes.SEARCH;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/focus_without_ink.js
var hideInk = false;
document.addEventListener("pointerdown", function() {
	hideInk = true;
}, true);
document.addEventListener("keydown", function() {
	hideInk = false;
}, true);
/**
* Attempts to track whether focus outlines should be shown, and if they
* shouldn't, removes the "ink" (ripple) from a control while focusing it.
* This is helpful when a user is clicking/touching, because it's not super
* helpful to show focus ripples in that case. This is Polymer-specific.
*/
function focusWithoutInk(toFocus) {
	if (!("noink" in toFocus) || !hideInk) {
		toFocus.focus();
		return;
	}
	const toFocusWithNoInk = toFocus;
	assert$1(document === toFocusWithNoInk.ownerDocument);
	const { noink } = toFocusWithNoInk;
	toFocusWithNoInk.noink = true;
	toFocusWithNoInk.focus();
	toFocusWithNoInk.noink = noink;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_page/settings_view_mixin.js
/**
* @fileoverview SettingsViewMixin is meant to be inherited by parent or child
* views belonging to a Settings plugin, to help with
*  a) focus preservation during navigation
*  b) search bubble showing during search
*
* If a parent view, need to override the following methods:
*   - getFocusConfig(): Used when navigating 'back' to focus the correct
*     element (the entry point to a child view).
*   - getAssociatedControlFor(): Used by SearchableViewContainerMixin to query
*     which element should be highlighted with a search bubble.
*
* If a child view, need to override the following method:
*   - focusBackButton(): Called when navigating into a child view to focus the
*     back button.
*/
var SettingsViewMixin = dedupingMixin((superClass) => {
	const superClassBase = RouteObserverMixin(superClass);
	class SettingsViewMixin extends superClassBase {
		focusConfig_ = null;
		previousRoute_ = null;
		static get properties() {
			return { routePath: String };
		}
		ready() {
			super.ready();
			/**
			* A Map specifying which element should be focused when exiting a
			* subpage. The key of the map holds a Route path, and the value
			* holds either a query selector that identifies the desired
			* element, an element or a function to be run.
			*/
			this.focusConfig_ = this.getFocusConfig();
			this.addEventListener("view-enter-start", this.onViewEnterStart_);
		}
		focusBackButton() {}
		getFocusConfig() {
			return null;
		}
		getAssociatedControlFor(_childViewId) {
			assertNotReached$1();
		}
		onViewEnterStart_() {
			if (this.previousRoute_ && !Router.getInstance().lastRouteChangeWasPopstate()) {
				this.focusBackButton();
				return;
			}
			if (!Router.getInstance().lastRouteChangeWasPopstate()) return;
			if (!this.focusConfig_ || !this.previousRoute_) return;
			const currentRoute = Router.getInstance().getCurrentRoute();
			const fromToKey = `${this.previousRoute_.path}_${currentRoute.path}`;
			let pathConfig = this.focusConfig_.get(fromToKey) || this.focusConfig_.get(this.previousRoute_.path);
			if (pathConfig) {
				let handler;
				if (typeof pathConfig === "function") handler = pathConfig;
				else handler = () => {
					if (typeof pathConfig === "string") {
						const element = this.shadowRoot.querySelector(pathConfig);
						assert$1(element);
						pathConfig = element;
					}
					focusWithoutInk(pathConfig);
				};
				handler();
			}
		}
		currentRouteChanged(_newRoute, oldRoute) {
			this.previousRoute_ = oldRoute || null;
		}
	}
	return SettingsViewMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/constants.js
var FeatureOptInState;
(function(FeatureOptInState) {
	FeatureOptInState[FeatureOptInState["NOT_INITIALIZED"] = 0] = "NOT_INITIALIZED";
	FeatureOptInState[FeatureOptInState["ENABLED"] = 1] = "ENABLED";
	FeatureOptInState[FeatureOptInState["DISABLED"] = 2] = "DISABLED";
})(FeatureOptInState || (FeatureOptInState = {}));
var ModelExecutionEnterprisePolicyValue;
(function(ModelExecutionEnterprisePolicyValue) {
	ModelExecutionEnterprisePolicyValue[ModelExecutionEnterprisePolicyValue["ALLOW"] = 0] = "ALLOW";
	ModelExecutionEnterprisePolicyValue[ModelExecutionEnterprisePolicyValue["ALLOW_WITHOUT_LOGGING"] = 1] = "ALLOW_WITHOUT_LOGGING";
	ModelExecutionEnterprisePolicyValue[ModelExecutionEnterprisePolicyValue["DISABLE"] = 2] = "DISABLE";
})(ModelExecutionEnterprisePolicyValue || (ModelExecutionEnterprisePolicyValue = {}));
var SettingsAiPageFeaturePrefName;
(function(SettingsAiPageFeaturePrefName) {
	SettingsAiPageFeaturePrefName["HISTORY_SEARCH"] = "optimization_guide.history_search_setting_state";
	SettingsAiPageFeaturePrefName["COMPOSE"] = "optimization_guide.compose_setting_state";
	SettingsAiPageFeaturePrefName["TAB_ORGANIZATION"] = "optimization_guide.tab_organization_setting_state";
	SettingsAiPageFeaturePrefName["AUTOFILL_AI"] = "autofill.autofill_ai.opt_in_status";
})(SettingsAiPageFeaturePrefName || (SettingsAiPageFeaturePrefName = {}));
var AiEnterpriseFeaturePrefName;
(function(AiEnterpriseFeaturePrefName) {
	AiEnterpriseFeaturePrefName["HISTORY_SEARCH"] = "optimization_guide.model_execution.history_search_enterprise_policy_allowed";
	AiEnterpriseFeaturePrefName["COMPOSE"] = "optimization_guide.model_execution.compose_enterprise_policy_allowed";
	AiEnterpriseFeaturePrefName["TAB_ORGANIZATION"] = "optimization_guide.model_execution.tab_organization_enterprise_policy_allowed";
	AiEnterpriseFeaturePrefName["AUTOFILL_AI"] = "optimization_guide.model_execution.autofill_prediction_improvements_enterprise_policy_allowed";
})(AiEnterpriseFeaturePrefName || (AiEnterpriseFeaturePrefName = {}));
var AiPageActions;
(function(AiPageActions) {
	AiPageActions["HISTORY_SEARCH_ENABLED"] = "Settings.AiPage.HistorySearch.Enabled";
	AiPageActions["HISTORY_SEARCH_DISABLED"] = "Settings.AiPage.HistorySearch.Disabled";
	AiPageActions["HISTORY_SEARCH_FEATURE_LINK_CLICKED"] = "Settings.AiPage.HistorySearch.FeatureLinkClicked";
	AiPageActions["HISTORY_SEARCH_LEARN_MORE_CLICKED"] = "Settings.AiPage.HistorySearch.LearnMoreClicked";
	AiPageActions["COMPOSE_LEARN_MORE_CLICKED"] = "Settings.AiPage.Compose.LearnMoreClicked";
	AiPageActions["COMPOSE_PROACTIVE_NUDGE_ENABLED"] = "Settings.AiPage.Compose.ProactiveNudgeEnabled";
	AiPageActions["COMPOSE_PROACTIVE_NUDGE_DISABLED"] = "Settings.AiPage.Compose.ProactiveNudgeDisabled";
	AiPageActions["TAB_ORGANIZATION_LEARN_MORE_CLICKED"] = "Settings.AiPage.TabOrganization.LearnMoreClicked";
	AiPageActions["GLIC_COLLAPSED_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicCollapsed.LearnMoreClicked";
	AiPageActions["GLIC_SHORTCUTS_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicShortcuts.LearnMoreClicked";
	AiPageActions["GLIC_SHORTCUTS_LAUNCHER_TOGGLE_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicShortcuts.LauncherToggleLearnMoreClicked";
	AiPageActions["GLIC_SHORTCUTS_LOCATION_TOGGLE_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicShortcuts.LocationToggleLearnMoreClicked";
	AiPageActions["GLIC_SHORTCUTS_TAB_ACCESS_TOGGLE_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicShortcuts.TabAccessToggleLearnMoreClicked";
	AiPageActions["GLIC_SHORTCUTS_DEFAULT_TAB_ACCESS_TOGGLE_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicShortcuts.DefaultTabAccessToggleLearnMoreClicked";
	AiPageActions["GLIC_SHORTCUTS_WEB_ACTUATION_TOGGLE_LEARN_MORE_CLICKED"] = "Settings.AiPage.GlicShortcuts.WebActuationToggleLearnMoreClicked";
})(AiPageActions || (AiPageActions = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_settings.js
/**
* A CSS attribute indicating that a node should be ignored during searching.
*/
var SKIP_SEARCH_CSS_ATTRIBUTE = "no-search";
/**
* List of elements types that should not be searched at all.
* The only DOM-MODULE node is in <body> which is not searched, therefore
* DOM-MODULE is not needed in this set.
*/
var IGNORED_ELEMENTS = /* @__PURE__ */ new Set([
	"CONTENT",
	"CR-ACTION-MENU",
	"CR-DIALOG",
	"CR-ICON",
	"CR-ICON-BUTTON",
	"CR-RIPPLE",
	"CR-SLIDER",
	"DIALOG",
	"IMG",
	"IRON-ICON",
	"IRON-LIST",
	"PAPER-RIPPLE",
	"PAPER-SPINNER-LITE",
	"SLOT",
	"STYLE",
	"TEMPLATE"
]);
/**
* Traverses the entire DOM (including Shadow DOM), finds text nodes that
* match the given regular expression and applies the highlight UI. It also
* ensures that <settings-section> instances become visible if any matches
* occurred under their subtree.
*
* @param root The root of the sub-tree to be searched
* @return The number of matches that were found.
*/
function findAndHighlightMatches(request, root) {
	let matchCount = 0;
	const highlights = [];
	function isInSubpage(node) {
		while (node !== null) {
			if (node.nodeName === "SETTINGS-SUBPAGE") return true;
			node = node instanceof ShadowRoot ? node.host : node.parentNode;
		}
		return false;
	}
	function doSearch(node) {
		if (IGNORED_ELEMENTS.has(node.nodeName)) return;
		if (node instanceof HTMLElement) {
			const element = node;
			if (element.hasAttribute(SKIP_SEARCH_CSS_ATTRIBUTE) || element.hasAttribute("hidden") || element.style.display === "none") return;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			const textContent = node.nodeValue;
			if (textContent.trim().length === 0) return;
			const strippedText = stripDiacritics(textContent);
			const ranges = [];
			for (let match; match = request.regExp.exec(strippedText);) ranges.push({
				start: match.index,
				length: match[0].length
			});
			if (ranges.length > 0) {
				matchCount += ranges.length;
				if (node.parentNode.nodeName === "OPTION") {
					const select = node.parentNode.parentNode;
					assert(select.nodeName === "SELECT");
					if (isInSubpage(select)) return;
					showBubble(select, ranges.length, request.bubbles, true);
				} else {
					request.addTextObserver(node);
					highlights.push(highlight(node, ranges));
				}
			}
			return;
		}
		let child = node.firstChild;
		while (child !== null) {
			const nextSibling = child.nextSibling;
			doSearch(child);
			child = nextSibling;
		}
		const shadowRoot = node.shadowRoot;
		if (shadowRoot) doSearch(shadowRoot);
	}
	doSearch(root);
	request.addHighlights(highlights);
	return matchCount;
}
function showBubble(control, newResults, bubbles, horizontallyCenter) {
	const bubble = createEmptySearchBubble(control, horizontallyCenter);
	const totalResults = (Number(bubble.dataset["results"]) || 0) + newResults;
	bubble.dataset["results"] = String(totalResults);
	bubbles.add(bubble);
	const msgName = totalResults === 1 ? "searchResultBubbleText" : "searchResultsBubbleText";
	bubble.firstChild.textContent = loadTimeData$2.getStringF(msgName, totalResults);
}
var Task = class {
	request;
	node;
	constructor(request, node) {
		this.request = request;
		this.node = node;
	}
};
var TopLevelSearchTask = class extends Task {
	exec() {
		if (this.request.regExp !== null) {
			const matchCount = findAndHighlightMatches(this.request, this.node);
			this.request.updateMatchCount(matchCount);
		}
		return Promise.resolve();
	}
};
var TaskQueue = class {
	request_;
	queues_;
	running_;
	onEmptyCallback_ = null;
	constructor(request) {
		this.request_ = request;
		this.reset();
		/**
		* Whether a task is currently running.
		*/
		this.running_ = false;
	}
	/** Drops all tasks. */
	reset() {
		this.queues_ = {
			high: [],
			low: []
		};
	}
	addTopLevelSearchTask(task) {
		this.queues_.high.push(task);
		this.consumePending_();
	}
	addSearchAndHighlightTask(task) {
		this.queues_.low.push(task);
		this.consumePending_();
	}
	/**
	* Registers a callback to be called every time the queue becomes empty.
	*/
	onEmpty(onEmptyCallback) {
		this.onEmptyCallback_ = onEmptyCallback;
	}
	popNextTask_() {
		return this.queues_.high.shift() || this.queues_.low.shift();
	}
	consumePending_() {
		if (this.running_) return;
		const task = this.popNextTask_();
		if (!task) {
			this.running_ = false;
			if (this.onEmptyCallback_) this.onEmptyCallback_();
			return;
		}
		this.running_ = true;
		requestIdleCallback(() => {
			if (!this.request_.canceled) task.exec().then(() => {
				this.running_ = false;
				this.consumePending_();
			});
		});
	}
};
var SearchRequest = class {
	rawQuery_;
	root_;
	regExp;
	canceled;
	matchCount_ = 0;
	resolver = new PromiseResolver();
	queue;
	textObservers_;
	highlights_;
	bubbles;
	constructor(rawQuery, root) {
		this.rawQuery_ = rawQuery;
		this.root_ = root;
		this.regExp = this.generateRegExp_();
		/**
		* Whether this request was canceled before completing.
		*/
		this.canceled = false;
		this.queue = new TaskQueue(this);
		this.queue.onEmpty(() => {
			this.resolver.resolve(this);
		});
		this.textObservers_ = /* @__PURE__ */ new Set();
		this.highlights_ = [];
		this.bubbles = /* @__PURE__ */ new Set();
	}
	/** @param highlights The highlight wrappers to add */
	addHighlights(highlights) {
		this.highlights_.push(...highlights);
	}
	removeAllTextObservers() {
		this.textObservers_.forEach((observer) => {
			observer.disconnect();
		});
		this.textObservers_.clear();
	}
	removeAllHighlightsAndBubbles() {
		removeHighlights(this.highlights_);
		this.highlights_ = [];
		for (const bubble of this.bubbles) bubble.remove();
		this.bubbles.clear();
	}
	addTextObserver(textNode) {
		const originalParentNode = textNode.parentNode;
		const observer = new MutationObserver((mutations) => {
			if (mutations[0].oldValue.trim() !== textNode.nodeValue.trim()) {
				observer.disconnect();
				this.textObservers_.delete(observer);
				findAndRemoveHighlights(originalParentNode);
			}
		});
		observer.observe(textNode, {
			characterData: true,
			characterDataOldValue: true
		});
		this.textObservers_.add(observer);
	}
	/**
	* Fires this search request.
	*/
	start() {
		this.queue.addTopLevelSearchTask(new TopLevelSearchTask(this, this.root_));
	}
	generateRegExp_() {
		let regExp = null;
		const sanitizedQuery = stripDiacritics(this.rawQuery_.trim()).replace(SANITIZE_REGEX, "\\$&");
		if (sanitizedQuery.length > 0) regExp = new RegExp(`(${sanitizedQuery})`, "ig");
		return regExp;
	}
	/**
	* @return Whether this SearchRequest refers to an identical query.
	*/
	isSame(rawQuery) {
		return this.rawQuery_ === rawQuery;
	}
	/**
	* Updates the number of search hits found for this search request.
	*/
	updateMatchCount(newMatches) {
		this.matchCount_ += newMatches;
	}
	getSearchResult() {
		assert(this.resolver.isFulfilled);
		return {
			canceled: this.canceled,
			matchCount: this.matchCount_,
			wasClearSearch: this.isSame("")
		};
	}
};
function combineSearchResults(results) {
	assert(results.length > 0);
	return {
		canceled: results.some((r) => r.canceled),
		matchCount: results.reduce((soFar, r) => soFar + r.matchCount, 0),
		wasClearSearch: results[0].wasClearSearch
	};
}
var SANITIZE_REGEX = /[-[\]{}()*+?.,\\^$|#\s]/g;
var SearchManagerImpl = class {
	activeRequests_ = /* @__PURE__ */ new Set();
	completedRequests_ = /* @__PURE__ */ new Set();
	lastSearchedText_ = null;
	search(text, page) {
		if (text !== this.lastSearchedText_) {
			this.activeRequests_.forEach(function(request) {
				request.removeAllTextObservers();
				request.removeAllHighlightsAndBubbles();
				request.canceled = true;
				request.resolver.resolve(request);
			});
			this.activeRequests_.clear();
			this.completedRequests_.forEach((request) => {
				request.removeAllTextObservers();
				request.removeAllHighlightsAndBubbles();
			});
			this.completedRequests_.clear();
		}
		this.lastSearchedText_ = text;
		const request = new SearchRequest(text, page);
		this.activeRequests_.add(request);
		request.start();
		return request.resolver.promise.then(() => {
			this.activeRequests_.delete(request);
			this.completedRequests_.add(request);
			return request;
		});
	}
};
var instance$28 = null;
function getSearchManager() {
	if (instance$28 === null) instance$28 = new SearchManagerImpl();
	return instance$28;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_page/searchable_view_container_mixin.js
/**
* @fileoverview SearchableViewContainerMixin implements the search and
* highlighting logic for a typical Settings plugin that has parent and child
* views. It assumes that a cr-view-manager is used to switch between all
* views, which are implemented as DOM siblings, regardress of whether they
* are presented to the user in a parent/child relationship. Each child view is
* expected to have a `[data-parent-view-id]` HTML attribute pointing to its
* parent view. This is necessary to properly reveal parent views when search
* results exist in child views, as well as to show search bubbles to guide the
* user to the child view's entry point. Parent views are expected to inherit
* from the SettingsViewMixin and properly overriding the
* `getAssociatedControlFor()` method.
*
* Note: Current implementation assumes that there are no
* parent/child/grandchild views, only parent/child.
*
* The exposed `shouldShowAll` computed property is meant to be bound to the
* cr-view-manager's `show-all` attribute. `inSearchMode` is expected to be
* populated by the parent element and is necessary to calculate
* shouldShowAll's value.
*/
var HIDDEN_BY_SEARCH = "hidden-by-search";
var SearchableViewContainerMixin = dedupingMixin((superClass) => {
	const superClassBase = RouteObserverMixin(superClass);
	class SearchableViewContainerMixin extends superClassBase {
		static get properties() {
			return {
				inSearchMode: {
					type: Boolean,
					value: false
				},
				currentRoute: {
					type: Object,
					value: null
				},
				shouldShowAll: {
					type: Boolean,
					computed: "computeShouldShowAll_(inSearchMode, currentRoute)"
				}
			};
		}
		getCrViewManager_() {
			const viewManager = this.shadowRoot.querySelector("cr-view-manager");
			assert$1(!!viewManager);
			return viewManager;
		}
		currentRouteChanged(route) {
			this.currentRoute = route;
		}
		async searchContents(query) {
			const parentViews = this.getCrViewManager_().querySelectorAll("[slot=view]:not([data-parent-view-id])");
			const parentPromises = Array.from(parentViews).map((view) => {
				return getSearchManager().search(query, view).then((request) => {
					const result = request.getSearchResult();
					if (result.wasClearSearch) {
						view.removeAttribute(HIDDEN_BY_SEARCH);
						return result;
					}
					view.toggleAttribute(HIDDEN_BY_SEARCH, result.matchCount === 0);
					return result;
				});
			});
			const parentsResult = combineSearchResults(await Promise.all(parentPromises));
			if (parentsResult.canceled) return parentsResult;
			const childViews = this.getCrViewManager_().querySelectorAll("[slot=view][data-parent-view-id]");
			const childPromises = Array.from(childViews).map((view) => {
				return getSearchManager().search(query, view).then((request) => {
					const result = request.getSearchResult();
					if (result.wasClearSearch || result.matchCount === 0) return result;
					const parentView = this.getCrViewManager_().querySelector(`#${view.dataset["parentViewId"]}`);
					assert$1(parentView);
					parentView.removeAttribute(HIDDEN_BY_SEARCH);
					showBubble(parentView.getAssociatedControlFor(view.id), result.matchCount, request.bubbles, false);
					return result;
				});
			});
			return combineSearchResults(await Promise.all([...parentPromises, ...childPromises]));
		}
		computeShouldShowAll_() {
			return this.inSearchMode && !!this.currentRoute && !this.currentRoute.isSubpage();
		}
	}
	return SearchableViewContainerMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button_style.css.js
var styleMod$6 = document.createElement("dom-module");
styleMod$6.appendChild(Ke`
  <template>
    <style>
:host{--cr-radio-button-checked-color:var(--color-radio-button-foreground-checked,var(--cr-fallback-color-primary));--cr-radio-button-checked-ripple-color:var(--cr-active-background-color);--cr-radio-button-ink-size:32px;--cr-radio-button-size:16px;--cr-radio-button-unchecked-color:var(--color-radio-button-foreground-unchecked,var(--cr-fallback-color-outline));--cr-radio-button-unchecked-ripple-color:var(--cr-active-background-color);--ink-to-circle:calc((var(--cr-radio-button-ink-size) - var(--cr-radio-button-size)) / 2);align-items:center;display:flex;flex-shrink:0;gap:var(--cr-radio-button-label-spacing,20px);outline:none}@media (prefers-color-scheme:dark){:host{--cr-radio-button-checked-color:var(--google-blue-300);--cr-radio-button-checked-ripple-color:rgba(var(--google-blue-300-rgb),.4);--cr-radio-button-unchecked-color:var(--google-grey-500);--cr-radio-button-unchecked-ripple-color:rgba(var(--google-grey-300-rgb),.4)}}@media (forced-colors:active){:host{--cr-radio-button-checked-color:SelectedItem;forced-color-adjust:none}}:host([disabled]){opacity:1;pointer-events:none;--cr-radio-button-checked-color:var(--color-radio-foreground-disabled,var(--cr-fallback-color-disabled-foreground));--cr-radio-button-unchecked-color:var(--color-radio-foreground-disabled,var(--cr-fallback-color-disabled-foreground))}:host(:not([disabled])){cursor:pointer}:host(.label-first){flex-direction:row-reverse}#labelWrapper{flex:1}:host([disabled]) #labelWrapper{opacity:var(--cr-disabled-opacity)}#label{color:inherit}:host([hide-label-text]) #label{clip:rect(0,0,0,0);display:block;position:fixed}.disc-border,.disc,.disc-wrapper,cr-ripple,paper-ripple{border-radius:50%}.disc-wrapper{height:var(--cr-radio-button-size);margin-block-start:var(--cr-radio-button-disc-margin-block-start,0);position:relative;width:var(--cr-radio-button-size)}.disc-border,.disc{box-sizing:border-box;height:var(--cr-radio-button-size);width:var(--cr-radio-button-size)}.disc-border{border:2px solid var(--cr-radio-button-unchecked-color)}:host([checked]) .disc-border{border-color:var(--cr-radio-button-checked-color)}#button:focus{outline:none}.disc{background-color:transparent;position:absolute;top:0;transform:scale(0);transition:border-color 200ms,transform 200ms}:host([checked]) .disc{background-color:var(--cr-radio-button-checked-color);transform:scale(0.5)}#overlay{border-radius:50%;box-sizing:border-box;display:none;height:var(--cr-radio-button-ink-size);left:50%;pointer-events:none;position:absolute;top:50%;transform:translate(-50%,-50%);width:var(--cr-radio-button-ink-size)}#button:hover #overlay{background-color:var(--cr-hover-background-color);display:block}#button:focus-visible #overlay{border:2px solid var(--cr-focus-outline-color);display:block}cr-ripple,paper-ripple{--paper-ripple-opacity:1;color:var(--cr-radio-button-unchecked-ripple-color);height:var(--cr-radio-button-ink-size);left:calc(-1 * var(--ink-to-circle));pointer-events:none;position:absolute;top:calc(-1 * var(--ink-to-circle));transition:color linear 80ms;width:var(--cr-radio-button-ink-size)}:host-context([dir=rtl]) cr-ripple,:host-context([dir=rtl]) paper-ripple{left:auto;right:calc(-1 * var(--ink-to-circle))}:host([checked]) cr-ripple,:host([checked]) paper-ripple{color:var(--cr-radio-button-checked-ripple-color)}
    </style>
  </template>
`.content);
styleMod$6.register("cr-radio-button-style");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/icons.html.js
var div$1 = document.createElement("div");
div$1.innerHTML = getTrustedHTML`
<cr-iconset name="cr20" size="20">
  <svg>
    <defs>
      <!--
      Keep these in sorted order by id="".
      -->
      <g id="block">
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM2 10C2 5.58 5.58 2 10 2C11.85 2 13.55 2.63 14.9 3.69L3.69 14.9C2.63 13.55 2 11.85 2 10ZM5.1 16.31C6.45 17.37 8.15 18 10 18C14.42 18 18 14.42 18 10C18 8.15 17.37 6.45 16.31 5.1L5.1 16.31Z">
        </path>
      </g>
      <g id="cloud-off">
        <path
          d="M16 18.125L13.875 16H5C3.88889 16 2.94444 15.6111 2.16667 14.8333C1.38889 14.0556 1 13.1111 1 12C1 10.9444 1.36111 10.0347 2.08333 9.27083C2.80556 8.50694 3.6875 8.09028 4.72917 8.02083C4.77083 7.86805 4.8125 7.72222 4.85417 7.58333C4.90972 7.44444 4.97222 7.30555 5.04167 7.16667L1.875 4L2.9375 2.9375L17.0625 17.0625L16 18.125ZM5 14.5H12.375L6.20833 8.33333C6.15278 8.51389 6.09722 8.70139 6.04167 8.89583C6 9.07639 5.95139 9.25694 5.89583 9.4375L4.83333 9.52083C4.16667 9.57639 3.61111 9.84028 3.16667 10.3125C2.72222 10.7708 2.5 11.3333 2.5 12C2.5 12.6944 2.74306 13.2847 3.22917 13.7708C3.71528 14.2569 4.30556 14.5 5 14.5ZM17.5 15.375L16.3958 14.2917C16.7153 14.125 16.9792 13.8819 17.1875 13.5625C17.3958 13.2431 17.5 12.8889 17.5 12.5C17.5 11.9444 17.3056 11.4722 16.9167 11.0833C16.5278 10.6944 16.0556 10.5 15.5 10.5H14.125L14 9.14583C13.9028 8.11806 13.4722 7.25694 12.7083 6.5625C11.9444 5.85417 11.0417 5.5 10 5.5C9.65278 5.5 9.31944 5.54167 9 5.625C8.69444 5.70833 8.39583 5.82639 8.10417 5.97917L7.02083 4.89583C7.46528 4.61806 7.93056 4.40278 8.41667 4.25C8.91667 4.08333 9.44444 4 10 4C11.4306 4 12.6736 4.48611 13.7292 5.45833C14.7847 6.41667 15.375 7.59722 15.5 9C16.4722 9 17.2986 9.34028 17.9792 10.0208C18.6597 10.7014 19 11.5278 19 12.5C19 13.0972 18.8611 13.6458 18.5833 14.1458C18.3194 14.6458 17.9583 15.0556 17.5 15.375Z">
        </path>
      </g>
      <g id="delete">
        <path
          d="M 5.832031 17.5 C 5.375 17.5 4.984375 17.335938 4.65625 17.011719 C 4.328125 16.683594 4.167969 16.292969 4.167969 15.832031 L 4.167969 5 L 3.332031 5 L 3.332031 3.332031 L 7.5 3.332031 L 7.5 2.5 L 12.5 2.5 L 12.5 3.332031 L 16.667969 3.332031 L 16.667969 5 L 15.832031 5 L 15.832031 15.832031 C 15.832031 16.292969 15.671875 16.683594 15.34375 17.011719 C 15.015625 17.335938 14.625 17.5 14.167969 17.5 Z M 14.167969 5 L 5.832031 5 L 5.832031 15.832031 L 14.167969 15.832031 Z M 7.5 14.167969 L 9.167969 14.167969 L 9.167969 6.667969 L 7.5 6.667969 Z M 10.832031 14.167969 L 12.5 14.167969 L 12.5 6.667969 L 10.832031 6.667969 Z M 5.832031 5 L 5.832031 15.832031 Z M 5.832031 5 ">
        </path>
      </g>
      <g id="domain" viewBox="0 -960 960 960">
        <path d="M96-144v-672h384v144h384v528H96Zm72-72h72v-72h-72v72Zm0-152h72v-72h-72v72Zm0-152h72v-72h-72v72Zm0-152h72v-72h-72v72Zm168 456h72v-72h-72v72Zm0-152h72v-72h-72v72Zm0-152h72v-72h-72v72Zm0-152h72v-72h-72v72Zm144 456h312v-384H480v80h72v72h-72v80h72v72h-72v80Zm168-232v-72h72v72h-72Zm0 152v-72h72v72h-72Z"></path>
      </g>
      <g id="kite">
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M4.6327 8.00094L10.3199 2L16 8.00094L10.1848 16.8673C10.0995 16.9873 10.0071 17.1074 9.90047 17.2199C9.42417 17.7225 8.79147 18 8.11611 18C7.44076 18 6.80806 17.7225 6.33175 17.2199C5.85545 16.7173 5.59242 16.0497 5.59242 15.3371C5.59242 14.977 5.46445 14.647 5.22275 14.3919C4.98104 14.1369 4.66825 14.0019 4.32701 14.0019H4V12.6667H4.32701C5.00237 12.6667 5.63507 12.9442 6.11137 13.4468C6.58768 13.9494 6.85071 14.617 6.85071 15.3296C6.85071 15.6896 6.97867 16.0197 7.22038 16.2747C7.46209 16.5298 7.77488 16.6648 8.11611 16.6648C8.45735 16.6648 8.77014 16.5223 9.01185 16.2747C9.02396 16.2601 9.03607 16.246 9.04808 16.2319C9.08541 16.1883 9.12176 16.1458 9.15403 16.0947L9.55213 15.4946L4.6327 8.00094ZM10.3199 13.9371L6.53802 8.17116L10.3199 4.1814L14.0963 8.17103L10.3199 13.9371Z">
        </path>
      </g>
      <g id="menu">
        <path d="M2 4h16v2H2zM2 9h16v2H2zM2 14h16v2H2z"></path>
      </g>
      <g id="password">
        <path d="M5.833 11.667c.458 0 .847-.16 1.167-.479.333-.333.5-.729.5-1.188s-.167-.847-.5-1.167a1.555 1.555 0 0 0-1.167-.5c-.458 0-.854.167-1.188.5A1.588 1.588 0 0 0 4.166 10c0 .458.16.854.479 1.188.333.319.729.479 1.188.479Zm0 3.333c-1.389 0-2.569-.486-3.542-1.458C1.319 12.569.833 11.389.833 10c0-1.389.486-2.569 1.458-3.542C3.264 5.486 4.444 5 5.833 5c.944 0 1.813.243 2.604.729a4.752 4.752 0 0 1 1.833 1.979h7.23c.458 0 .847.167 1.167.5.333.319.5.708.5 1.167v3.958c0 .458-.167.854-.5 1.188A1.588 1.588 0 0 1 17.5 15h-3.75a1.658 1.658 0 0 1-1.188-.479 1.658 1.658 0 0 1-.479-1.188v-1.042H10.27a4.59 4.59 0 0 1-1.813 2A5.1 5.1 0 0 1 5.833 15Zm3.292-4.375h4.625v2.708H15v-1.042a.592.592 0 0 1 .167-.438.623.623 0 0 1 .458-.188c.181 0 .327.063.438.188a.558.558 0 0 1 .188.438v1.042H17.5V9.375H9.125a3.312 3.312 0 0 0-1.167-1.938 3.203 3.203 0 0 0-2.125-.77 3.21 3.21 0 0 0-2.354.979C2.827 8.298 2.5 9.083 2.5 10s.327 1.702.979 2.354a3.21 3.21 0 0 0 2.354.979c.806 0 1.514-.25 2.125-.75.611-.514 1-1.167 1.167-1.958Z"></path>
      </g>
      
  </svg>
</cr-iconset>

<!-- NOTE: In the common case that the final icon will be 20x20, export the SVG
     at 20px and place it in the section above. -->
<cr-iconset name="cr" size="24">
  <svg>
    <defs>
      <!--
      These icons are copied from Polymer's iron-icons and kept in sorted order.
      -->
      <g id="add">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </g>
      <g id="arrow-back">
        <path
          d="m7.824 13 5.602 5.602L12 20l-8-8 8-8 1.426 1.398L7.824 11H20v2Zm0 0">
        </path>
      </g>
      <g id="arrow-drop-up">
        <path d="M7 14l5-5 5 5z"></path>
      </g>
      <g id="arrow-drop-down">
        <path d="M7 10l5 5 5-5z"></path>
      </g>
      <g id="arrow-forward">
        <path
          d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z">
        </path>
      </g>
      <g id="arrow-right">
        <path d="M10 7l5 5-5 5z"></path>
      </g>
      <g id="cancel">
        <path
          d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z">
        </path>
      </g>
      <g id="check">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
      </g>
      <g id="check-circle" viewBox="0 -960 960 960">
        <path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"></path>
      </g>
      <g id="chevron-left">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path>
      </g>
      <g id="chevron-right">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"></path>
      </g>
      <g id="clear">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z">
        </path>
      </g>
      <g id="chrome-product" viewBox="0 -960 960 960">
        <path d="M336-479q0 60 42 102t102 42q60 0 102-42t42-102q0-60-42-102t-102-42q-60 0-102 42t-42 102Zm144 216q11 0 22.5-.5T525-267L427-99q-144-16-237.5-125T96-479q0-43 9.5-84.5T134-645l160 274q28 51 78 79.5T480-263Zm0-432q-71 0-126.5 42T276-545l-98-170q53-71 132.5-109.5T480-863q95 0 179 45t138 123H480Zm356 72q15 35 21.5 71t6.5 73q0 155-100 260.5T509-96l157-275q14-25 22-52t8-56q0-40-15-77t-41-67h196Z">
        </path>
      </g>
      <g id="close">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z">
        </path>
      </g>
      <g id="computer">
        <path
          d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z">
        </path>
      </g>
      <g id="create">
        <path
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z">
        </path>
      </g>
      <g id="delete" viewBox="0 -960 960 960">
        <path
          d="M309.37-135.87q-34.48 0-58.74-24.26-24.26-24.26-24.26-58.74v-474.5h-53.5v-83H378.5v-53.5h202.52v53.5h206.11v83h-53.5v474.07q0 35.21-24.26 59.32t-58.74 24.11H309.37Zm341.26-557.5H309.37v474.5h341.26v-474.5ZM379.7-288.24h77.5v-336h-77.5v336Zm123.1 0h77.5v-336h-77.5v336ZM309.37-693.37v474.5-474.5Z">
        </path>
      </g>
      <g id="domain">
        <path
          d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z">
        </path>
      </g>
      <!-- source: https://fonts.google.com/icons?selected=Material+Symbols+Outlined:family_link:FILL@0;wght@0;GRAD@0;opsz@24&icon.size=24&icon.color=%23e8eaed -->
      <g id="kite" viewBox="0 -960 960 960">
        <path
          d="M390-40q-51 0-90.5-30.5T246-149q-6-23-25-37t-43-14q-16 0-30 6.5T124-175l-61-51q21-26 51.5-40t63.5-14q51 0 91 30t54 79q6 23 25 37t42 14q19 0 34-10t26-25l1-2-276-381q-8-11-11.5-23t-3.5-24q0-16 6-30.5t18-26.5l260-255q11-11 26-17t30-6q15 0 30 6t26 17l260 255q12 12 18 26.5t6 30.5q0 12-3.5 24T825-538L500-88q-18 25-48 36.5T390-40Zm110-185 260-360-260-255-259 256 259 359Zm1-308Z"/>
        </path>
      </g>
      <g id="error">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z">
        </path>
      </g>
      <g id="error-outline">
        <path
          d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z">
        </path>
      </g>
      <g id="expand-less">
        <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"></path>
      </g>
      <g id="expand-more">
        <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"></path>
      </g>
      <g id="extension">
        <path
          d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z">
        </path>
      </g>
      <g id="file-download" viewBox="0 -960 960 960">
        <path d="M480-336 288-528l51-51 105 105v-342h72v342l105-105 51 51-192 192ZM263.72-192Q234-192 213-213.15T192-264v-72h72v72h432v-72h72v72q0 29.7-21.16 50.85Q725.68-192 695.96-192H263.72Z"></path>
      </g>
      <g id="fullscreen">
        <path
          d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z">
        </path>
      </g>
      <g id="group">
        <path
          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z">
        </path>
      </g>
      <g id="help-outline">
        <path
          d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z">
        </path>
      </g>
      <g id="history">
        <path
          d="M12.945312 22.75 C 10.320312 22.75 8.074219 21.839844 6.207031 20.019531 C 4.335938 18.199219 3.359375 15.972656 3.269531 13.34375 L 5.089844 13.34375 C 5.175781 15.472656 5.972656 17.273438 7.480469 18.742188 C 8.988281 20.210938 10.808594 20.945312 12.945312 20.945312 C 15.179688 20.945312 17.070312 20.164062 18.621094 18.601562 C 20.167969 17.039062 20.945312 15.144531 20.945312 12.910156 C 20.945312 10.714844 20.164062 8.855469 18.601562 7.335938 C 17.039062 5.816406 15.15625 5.054688 12.945312 5.054688 C 11.710938 5.054688 10.554688 5.339844 9.480469 5.902344 C 8.402344 6.46875 7.476562 7.226562 6.699219 8.179688 L 9.585938 8.179688 L 9.585938 9.984375 L 3.648438 9.984375 L 3.648438 4.0625 L 5.453125 4.0625 L 5.453125 6.824219 C 6.386719 5.707031 7.503906 4.828125 8.804688 4.199219 C 10.109375 3.566406 11.488281 3.25 12.945312 3.25 C 14.300781 3.25 15.570312 3.503906 16.761719 4.011719 C 17.949219 4.519531 18.988281 5.214844 19.875 6.089844 C 20.761719 6.964844 21.464844 7.992188 21.976562 9.167969 C 22.492188 10.34375 22.75 11.609375 22.75 12.964844 C 22.75 14.316406 22.492188 15.589844 21.976562 16.777344 C 21.464844 17.964844 20.761719 19.003906 19.875 19.882812 C 18.988281 20.765625 17.949219 21.464844 16.761719 21.976562 C 15.570312 22.492188 14.300781 22.75 12.945312 22.75 Z M 16.269531 17.460938 L 12.117188 13.34375 L 12.117188 7.527344 L 13.921875 7.527344 L 13.921875 12.601562 L 17.550781 16.179688 Z M 16.269531 17.460938">
        </path>
      </g>
      <g id="info">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z">
        </path>
      </g>
      <g id="info-outline">
        <path
          d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z">
        </path>
      </g>
      <g id="insert-drive-file">
        <path
          d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z">
        </path>
      </g>
      <g id="location-on">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z">
        </path>
      </g>
      <g id="mic">
        <path
          d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z">
        </path>
      </g>
      <g id="more-vert">
        <path
          d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z">
        </path>
      </g>
      <g id="open-in-new" viewBox="0 -960 960 960">
        <path
          d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h264v72H216v528h528v-264h72v264q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm171-192-51-51 357-357H576v-72h240v240h-72v-117L387-336Z">
        </path>
      </g>
      <g id="person">
        <path
          d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z">
        </path>
      </g>
      <g id="phonelink">
        <path
          d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z">
        </path>
      </g>
      <g id="print">
        <path
          d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z">
        </path>
      </g>
      <g id="schedule">
        <path
          d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z">
        </path>
      </g>
      <g id="search">
        <path
          d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z">
        </path>
      </g>
      <g id="security">
        <path
          d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z">
        </path>
      </g>
      <!-- The <g> IDs are exposed as global variables in Vulcanized mode, which
        conflicts with the "settings" namespace of MD Settings. Using an "_icon"
        suffix prevents the naming conflict. -->
      <g id="settings_icon">
        <path
          d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z">
        </path>
      </g>
      <g id="star">
        <path
          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z">
        </path>
      </g>
      <g id="sync" viewBox="0 -960 960 960">
        <path
          d="M216-192v-72h74q-45-40-71.5-95.5T192-480q0-101 61-177.5T408-758v75q-63 23-103.5 77.5T264-480q0 48 19.5 89t52.5 70v-63h72v192H216Zm336-10v-75q63-23 103.5-77.5T696-480q0-48-19.5-89T624-639v63h-72v-192h192v72h-74q45 40 71.5 95.5T768-480q0 101-61 177.5T552-202Z">
        </path>
      </g>
      <g id="thumbs-down">
        <path
            d="M6 3h11v13l-7 7-1.25-1.25a1.454 1.454 0 0 1-.3-.475c-.067-.2-.1-.392-.1-.575v-.35L9.45 16H3c-.533 0-1-.2-1.4-.6-.4-.4-.6-.867-.6-1.4v-2c0-.117.017-.242.05-.375s.067-.258.1-.375l3-7.05c.15-.333.4-.617.75-.85C5.25 3.117 5.617 3 6 3Zm9 2H6l-3 7v2h9l-1.35 5.5L15 15.15V5Zm0 10.15V5v10.15Zm2 .85v-2h3V5h-3V3h5v13h-5Z">
        </path>
      </g>
      <g id="thumbs-down-filled">
        <path
            d="M6 3h10v13l-7 7-1.25-1.25a1.336 1.336 0 0 1-.29-.477 1.66 1.66 0 0 1-.108-.574v-.347L8.449 16H3c-.535 0-1-.2-1.398-.602C1.199 15 1 14.535 1 14v-2c0-.117.012-.242.04-.375.022-.133.062-.258.108-.375l3-7.05c.153-.333.403-.618.75-.848A1.957 1.957 0 0 1 6 3Zm12 13V3h4v13Zm0 0">
        </path>
      </g>
      <g id="thumbs-up">
        <path
            d="M18 21H7V8l7-7 1.25 1.25c.117.117.208.275.275.475.083.2.125.392.125.575v.35L14.55 8H21c.533 0 1 .2 1.4.6.4.4.6.867.6 1.4v2c0 .117-.017.242-.05.375s-.067.258-.1.375l-3 7.05c-.15.333-.4.617-.75.85-.35.233-.717.35-1.1.35Zm-9-2h9l3-7v-2h-9l1.35-5.5L9 8.85V19ZM9 8.85V19 8.85ZM7 8v2H4v9h3v2H2V8h5Z">
        </path>
      </g>
      <g id="thumbs-up-filled">
        <path
            d="M18 21H8V8l7-7 1.25 1.25c.117.117.21.273.29.477.073.199.108.39.108.574v.347L15.551 8H21c.535 0 1 .2 1.398.602C22.801 9 23 9.465 23 10v2c0 .117-.012.242-.04.375a1.897 1.897 0 0 1-.108.375l-3 7.05a2.037 2.037 0 0 1-.75.848A1.957 1.957 0 0 1 18 21ZM6 8v13H2V8Zm0 0">
      </g>
      <g id="videocam" viewBox="0 -960 960 960">
        <path
          d="M216-192q-29 0-50.5-21.5T144-264v-432q0-29.7 21.5-50.85Q187-768 216-768h432q29.7 0 50.85 21.15Q720-725.7 720-696v168l144-144v384L720-432v168q0 29-21.15 50.5T648-192H216Zm0-72h432v-432H216v432Zm0 0v-432 432Z">
        </path>
      </g>
      <g id="warning">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"></path>
      </g>
    </defs>
  </svg>
</cr-iconset>`;
var iconsets$1 = div$1.querySelectorAll("cr-iconset");
for (const iconset of iconsets$1) document.head.appendChild(iconset);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_tooltip/cr_tooltip.css.js
var instance$27 = null;
function getCss$9() {
	return instance$27 || (instance$27 = [...[getCss$13()], i$4`:host{display:block;position:absolute;outline:none;z-index:1002;user-select:none;cursor:default}#tooltip{display:block;outline:none;font-size:10px;line-height:1;background-color:var(--paper-tooltip-background,#616161);color:var(--paper-tooltip-text-color,white);padding:8px;border-radius:2px}@keyframes keyFrameFadeInOpacity{0%{opacity:0}100%{opacity:var(--paper-tooltip-opacity,0.9)}}@keyframes keyFrameFadeOutOpacity{0%{opacity:var(--paper-tooltip-opacity,0.9)}100%{opacity:0}}.fade-in-animation{opacity:0;animation-delay:var(--paper-tooltip-delay-in,500ms);animation-name:keyFrameFadeInOpacity;animation-iteration-count:1;animation-timing-function:ease-in;animation-duration:var(--paper-tooltip-duration-in,500ms);animation-fill-mode:forwards}.fade-out-animation{opacity:var(--paper-tooltip-opacity,0.9);animation-delay:var(--paper-tooltip-delay-out,0ms);animation-name:keyFrameFadeOutOpacity;animation-iteration-count:1;animation-timing-function:ease-in;animation-duration:var(--paper-tooltip-duration-out,500ms);animation-fill-mode:forwards}#tooltipOffsetFiller{position:absolute;:host([position='top']) &{top:100%}:host([position='bottom']) &{bottom:100%}:host([position='left']) &{left:100%}:host([position='right']) &{right:100%}:host(:is([position='top'],[position='bottom'])) &{left:0;height:var(--cr-tooltip-offset);width:100%}:host(:is([position='left'],[position='right'])) &{top:0;height:100%;width:var(--cr-tooltip-offset)}}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_tooltip/cr_tooltip.html.js
function getHtml$6() {
	return x`
    <div id="tooltip" hidden part="tooltip">
      <slot></slot>
    </div>
    <div id="tooltipOffsetFiller"></div>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_tooltip/cr_tooltip.js
/**
* @fileoverview Tooltip with simple fade-in/out animations. Forked/migrated
* from Polymer's paper-tooltip.
*/
var TooltipPosition;
(function(TooltipPosition) {
	TooltipPosition["TOP"] = "top";
	TooltipPosition["BOTTOM"] = "bottom";
	TooltipPosition["LEFT"] = "left";
	TooltipPosition["RIGHT"] = "right";
})(TooltipPosition || (TooltipPosition = {}));
var CrTooltipElement = class extends CrLitElement {
	static get is() {
		return "cr-tooltip";
	}
	static get styles() {
		return getCss$9();
	}
	render() {
		return getHtml$6.bind(this)();
	}
	static get properties() {
		return {
			/**
			* The id of the element that the tooltip is anchored to. This element
			* must be a sibling of the tooltip. If this property is not set,
			* then the tooltip will be centered to the parent node containing it.
			*/
			for: { type: String },
			/**
			* Set this to true if you want to manually control when the tooltip
			* is shown or hidden.
			*/
			manualMode: { type: Boolean },
			/**
			* Positions the tooltip to the top, right, bottom, left of its content.
			*/
			position: {
				type: String,
				reflect: true
			},
			/**
			* If true, no parts of the tooltip will ever be shown offscreen.
			*/
			fitToVisibleBounds: { type: Boolean },
			/**
			* The spacing between the top of the tooltip and the element it is
			* anchored to.
			*/
			offset: { type: Number },
			/**
			* The delay that will be applied before the `entry` animation is
			* played when showing the tooltip.
			*/
			animationDelay: { type: Number },
			/**
			* The delay before the tooltip hides itself after moving the pointer
			* away from the tooltip or target.
			*/
			hideDelay: { type: Number }
		};
	}
	#animationDelay_accessor_storage = 500;
	get animationDelay() {
		return this.#animationDelay_accessor_storage;
	}
	set animationDelay(value) {
		this.#animationDelay_accessor_storage = value;
	}
	#fitToVisibleBounds_accessor_storage = false;
	get fitToVisibleBounds() {
		return this.#fitToVisibleBounds_accessor_storage;
	}
	set fitToVisibleBounds(value) {
		this.#fitToVisibleBounds_accessor_storage = value;
	}
	#hideDelay_accessor_storage = 600;
	get hideDelay() {
		return this.#hideDelay_accessor_storage;
	}
	set hideDelay(value) {
		this.#hideDelay_accessor_storage = value;
	}
	#for_accessor_storage = "";
	get for() {
		return this.#for_accessor_storage;
	}
	set for(value) {
		this.#for_accessor_storage = value;
	}
	#manualMode_accessor_storage = false;
	get manualMode() {
		return this.#manualMode_accessor_storage;
	}
	set manualMode(value) {
		this.#manualMode_accessor_storage = value;
	}
	#offset_accessor_storage = 14;
	get offset() {
		return this.#offset_accessor_storage;
	}
	set offset(value) {
		this.#offset_accessor_storage = value;
	}
	#position_accessor_storage = TooltipPosition.BOTTOM;
	get position() {
		return this.#position_accessor_storage;
	}
	set position(value) {
		this.#position_accessor_storage = value;
	}
	animationPlaying_ = false;
	showing_ = false;
	manualTarget_;
	target_ = null;
	tracker_ = new EventTracker();
	hideTimeout_ = null;
	connectedCallback() {
		super.connectedCallback();
		this.findTarget_();
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		if (!this.manualMode) this.removeListeners_();
		this.resetHideTimeout_();
	}
	firstUpdated(changedProperties) {
		super.firstUpdated(changedProperties);
		this.addEventListener("animationend", () => this.onAnimationEnd_());
	}
	willUpdate(changedProperties) {
		super.willUpdate(changedProperties);
		if (changedProperties.has("animationDelay")) this.style.setProperty("--paper-tooltip-delay-in", `${this.animationDelay}ms`);
	}
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("for")) this.findTarget_();
		if (changedProperties.has("manualMode")) {
			if (this.manualMode) this.removeListeners_();
			else this.addListeners_();
		}
		if (changedProperties.has("offset")) this.style.setProperty("--cr-tooltip-offset", `${this.offset}px`);
	}
	/**
	* Returns the target element that this tooltip is anchored to. It is
	* either the element given by the `for` attribute, the element manually
	* specified through the `target` attribute, or the immediate parent of
	* the tooltip.
	*/
	get target() {
		if (this.manualTarget_) return this.manualTarget_;
		const ownerRoot = this.getRootNode();
		if (this.for) return ownerRoot.querySelector(`#${this.for}`);
		const parentNode = this.parentNode;
		return !!parentNode && parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? ownerRoot.host : parentNode;
	}
	/**
	* Sets the target element that this tooltip will be anchored to.
	*/
	set target(target) {
		this.manualTarget_ = target;
		this.findTarget_();
	}
	/**
	* Shows the tooltip programmatically
	*/
	show() {
		this.resetHideTimeout_();
		if (this.showing_) return;
		if (!!this.textContent && this.textContent.trim() === "") {
			const children = this.shadowRoot.querySelector("slot").assignedElements();
			if (!Array.from(children).some((el) => !!el.textContent && el.textContent.trim() !== "")) return;
		}
		this.showing_ = true;
		this.$.tooltip.hidden = false;
		this.$.tooltip.classList.remove("fade-out-animation");
		this.updatePosition();
		this.animationPlaying_ = true;
		this.$.tooltip.classList.add("fade-in-animation");
	}
	/**
	* Hides the tooltip programmatically
	*/
	hide() {
		if (!this.showing_) return;
		if (this.animationPlaying_) {
			this.showing_ = false;
			this.$.tooltip.classList.remove("fade-in-animation", "fade-out-animation");
			this.$.tooltip.hidden = true;
			return;
		}
		this.$.tooltip.classList.remove("fade-in-animation");
		this.$.tooltip.classList.add("fade-out-animation");
		this.showing_ = false;
		this.animationPlaying_ = true;
	}
	queueHide_() {
		this.resetHideTimeout_();
		this.hideTimeout_ = setTimeout(() => {
			this.hide();
			this.hideTimeout_ = null;
		}, this.hideDelay);
	}
	resetHideTimeout_() {
		if (this.hideTimeout_ !== null) {
			clearTimeout(this.hideTimeout_);
			this.hideTimeout_ = null;
		}
	}
	updatePosition() {
		if (!this.target_) return;
		const offsetParent = this.offsetParent || this.composedOffsetParent_();
		if (!offsetParent) return;
		const offset = this.offset;
		const parentRect = offsetParent.getBoundingClientRect();
		const targetRect = this.target_.getBoundingClientRect();
		const tooltipRect = this.$.tooltip.getBoundingClientRect();
		const horizontalCenterOffset = (targetRect.width - tooltipRect.width) / 2;
		const verticalCenterOffset = (targetRect.height - tooltipRect.height) / 2;
		const targetLeft = targetRect.left - parentRect.left;
		const targetTop = targetRect.top - parentRect.top;
		let tooltipLeft;
		let tooltipTop;
		switch (this.position) {
			case TooltipPosition.TOP:
				tooltipLeft = targetLeft + horizontalCenterOffset;
				tooltipTop = targetTop - tooltipRect.height - offset;
				break;
			case TooltipPosition.BOTTOM:
				tooltipLeft = targetLeft + horizontalCenterOffset;
				tooltipTop = targetTop + targetRect.height + offset;
				break;
			case TooltipPosition.LEFT:
				tooltipLeft = targetLeft - tooltipRect.width - offset;
				tooltipTop = targetTop + verticalCenterOffset;
				break;
			case TooltipPosition.RIGHT:
				tooltipLeft = targetLeft + targetRect.width + offset;
				tooltipTop = targetTop + verticalCenterOffset;
				break;
			default: assertNotReachedCase$1(this.position);
		}
		if (this.fitToVisibleBounds) {
			if (parentRect.left + tooltipLeft + tooltipRect.width > window.innerWidth) {
				this.style.right = "0px";
				this.style.left = "auto";
			} else {
				this.style.left = Math.max(0, tooltipLeft) + "px";
				this.style.right = "auto";
			}
			if (parentRect.top + tooltipTop + tooltipRect.height > window.innerHeight) {
				this.style.bottom = parentRect.height - targetTop + offset + "px";
				this.style.top = "auto";
			} else {
				this.style.top = Math.max(-parentRect.top, tooltipTop) + "px";
				this.style.bottom = "auto";
			}
		} else {
			this.style.left = tooltipLeft + "px";
			this.style.top = tooltipTop + "px";
		}
	}
	findTarget_() {
		if (!this.manualMode) this.removeListeners_();
		this.target_ = this.target;
		if (!this.manualMode) this.addListeners_();
	}
	onAnimationEnd_() {
		this.animationPlaying_ = false;
		if (!this.showing_) {
			this.$.tooltip.classList.remove("fade-out-animation");
			this.$.tooltip.hidden = true;
		}
	}
	addListeners_() {
		if (this.target_) {
			this.tracker_.add(this.target_, "pointerenter", () => this.show());
			this.tracker_.add(this.target_, "focus", () => this.show());
			this.tracker_.add(this.target_, "pointerleave", () => this.queueHide_());
			this.tracker_.add(this.target_, "blur", () => this.hide());
			this.tracker_.add(this.target_, "click", () => this.hide());
		}
		this.tracker_.add(this.$.tooltip, "animationend", () => this.onAnimationEnd_());
		this.tracker_.add(this, "pointerenter", () => this.show());
		this.tracker_.add(this, "pointerleave", () => this.queueHide_());
	}
	removeListeners_() {
		this.tracker_.removeAll();
	}
	/**
	* Polyfills the old offsetParent behavior from before the spec was changed:
	* https://github.com/w3c/csswg-drafts/issues/159
	* This is necessary when the tooltip is inside a <slot>, e.g. when it
	* is used inside a cr-dialog. In such cases, the tooltip's offsetParent
	* will be null.
	*/
	composedOffsetParent_() {
		if (this.computedStyleMap().get("display").value === "none") return null;
		for (let ancestor = flatTreeParent(this); ancestor !== null; ancestor = flatTreeParent(ancestor)) {
			if (!(ancestor instanceof Element)) continue;
			const style = ancestor.computedStyleMap();
			if (style.get("display").value === "none") return null;
			if (style.get("display").value === "contents") continue;
			if (style.get("position").value !== "static") return ancestor;
			if (ancestor.tagName === "BODY") return ancestor;
		}
		return null;
		function flatTreeParent(element) {
			if (element.assignedSlot) return element.assignedSlot;
			if (element.parentNode instanceof ShadowRoot) return element.parentNode.host;
			return element.parentElement;
		}
	}
};
customElements.define(CrTooltipElement.is, CrTooltipElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_icons_lit.css.js
var instance$26 = null;
function getCss$8() {
	return instance$26 || (instance$26 = [...[], i$4`.icon-arrow-back{--cr-icon-image:url(//resources/images/icon_arrow_back.svg)}.icon-arrow-dropdown{--cr-icon-image:url(//resources/images/icon_arrow_dropdown.svg)}.icon-arrow-drop-down-cr23{--cr-icon-image:url(//resources/images/icon_arrow_drop_down_cr23.svg)}.icon-arrow-drop-up-cr23{--cr-icon-image:url(//resources/images/icon_arrow_drop_up_cr23.svg)}.icon-arrow-upward{--cr-icon-image:url(//resources/images/icon_arrow_upward.svg)}.icon-cancel{--cr-icon-image:url(//resources/images/icon_cancel.svg)}.icon-clear{--cr-icon-image:url(//resources/images/icon_clear.svg)}.icon-copy-content{--cr-icon-image:url(//resources/images/icon_copy_content.svg)}.icon-delete-gray{--cr-icon-image:url(//resources/images/icon_delete_gray.svg)}.icon-edit{--cr-icon-image:url(//resources/images/icon_edit.svg)}.icon-file{--cr-icon-image:url(//resources/images/icon_filetype_generic.svg)}.icon-folder-open{--cr-icon-image:url(//resources/images/icon_folder_open.svg)}.icon-picture-delete{--cr-icon-image:url(//resources/images/icon_picture_delete.svg)}.icon-expand-less{--cr-icon-image:url(//resources/images/icon_expand_less.svg)}.icon-expand-more{--cr-icon-image:url(//resources/images/icon_expand_more.svg)}.icon-external{--cr-icon-image:url(//resources/images/open_in_new.svg)}.icon-more-vert{--cr-icon-image:url(//resources/images/icon_more_vert.svg)}.icon-refresh{--cr-icon-image:url(//resources/images/icon_refresh.svg)}.icon-search{--cr-icon-image:url(//resources/images/icon_search.svg)}.icon-settings{--cr-icon-image:url(//resources/images/icon_settings.svg)}.icon-visibility{--cr-icon-image:url(//resources/images/icon_visibility.svg)}.icon-visibility-off{--cr-icon-image:url(//resources/images/icon_visibility_off.svg)}.icon-visibility-refresh{--cr-icon-image:url(//resources/images/icon_visibility_refresh.svg)}.icon-visibility-off-refresh{--cr-icon-image:url(//resources/images/icon_visibility_off_refresh.svg)}.subpage-arrow{--cr-icon-image:url(//resources/images/arrow_right.svg)}.cr-icon{-webkit-mask-image:var(--cr-icon-image);-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;-webkit-mask-size:var(--cr-icon-size);background-color:var(--cr-icon-color,var(--google-grey-700));flex-shrink:0;height:var(--cr-icon-ripple-size);margin-inline-end:var(--cr-icon-ripple-margin);margin-inline-start:var(--cr-icon-button-margin-start);user-select:none;width:var(--cr-icon-ripple-size)}:host-context([dir=rtl]) .cr-icon{transform:scaleX(-1)}.cr-icon.no-overlap{margin-inline-end:0;margin-inline-start:0}@media (prefers-color-scheme:dark){.cr-icon{background-color:var(--cr-icon-color,var(--google-grey-500))}}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_shared_style_lit.css.js
var instance$25 = null;
function getCss$7() {
	return instance$25 || (instance$25 = [...[getCss$13(), getCss$8()], i$4`[actionable]{cursor:pointer}.hr{border-top:var(--cr-separator-line)}iron-list.cr-separators>*:not([first]){border-top:var(--cr-separator-line)}[scrollable]{border-color:transparent;border-style:solid;border-width:1px 0;overflow-y:auto}[scrollable].is-scrolled{border-top-color:var(--cr-scrollable-border-color)}[scrollable].can-scroll:not(.scrolled-to-bottom){border-bottom-color:var(--cr-scrollable-border-color)}[scrollable] iron-list>:not(.no-outline):focus-visible,[selectable]:focus-visible,[selectable]>:focus-visible{outline:solid 2px var(--cr-focus-outline-color);outline-offset:-2px}.scroll-container{display:flex;flex-direction:column;min-height:1px}[selectable]>*{cursor:pointer}.cr-centered-card-container{box-sizing:border-box;display:block;height:inherit;margin:0 auto;max-width:var(--cr-centered-card-max-width);min-width:550px;position:relative;width:calc(100% * var(--cr-centered-card-width-percentage))}.cr-row{align-items:center;border-top:var(--cr-separator-line);display:flex;min-height:var(--cr-section-min-height);padding:0 var(--cr-section-padding)}.cr-row.first,.cr-row.continuation{border-top:none}.cr-row-gap{padding-inline-start:16px}.cr-button-gap{margin-inline-start:8px}paper-tooltip::part(tooltip),cr-tooltip::part(tooltip){border-radius:var(--paper-tooltip-border-radius,2px);font-size:92.31%;font-weight:500;max-width:330px;min-width:var(--paper-tooltip-min-width,200px);padding:var(--paper-tooltip-padding,10px 8px)}.cr-padded-text{padding-block-end:var(--cr-section-vertical-padding);padding-block-start:var(--cr-section-vertical-padding)}.cr-title-text{color:var(--cr-title-text-color);font-size:107.6923%;font-weight:500}.cr-secondary-text{color:var(--cr-secondary-text-color);font-weight:400}.cr-form-field-label{color:var(--cr-form-field-label-color);display:block;font-size:var(--cr-form-field-label-font-size);font-weight:500;letter-spacing:.4px;line-height:var(--cr-form-field-label-line-height);margin-bottom:8px}.cr-vertical-tab{align-items:center;display:flex}.cr-vertical-tab::before{border-radius:0 3px 3px 0;content:'';display:block;flex-shrink:0;height:var(--cr-vertical-tab-height,100%);width:4px}.cr-vertical-tab.selected::before{background:var(--cr-vertical-tab-selected-color,var(--cr-checked-color))}:host-context([dir=rtl]) .cr-vertical-tab::before{transform:scaleX(-1)}.iph-anchor-highlight{background-color:var(--cr-iph-anchor-highlight-color)}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/policy/cr_tooltip_icon.css.js
var instance$24 = null;
function getCss$6() {
	return instance$24 || (instance$24 = [...[getCss$7()], i$4`:host{display:flex}cr-icon{--iron-icon-width:var(--cr-icon-size);--iron-icon-height:var(--cr-icon-size);--iron-icon-fill-color:var(--cr-tooltip-icon-fill-color,var(--google-grey-700))}@media (prefers-color-scheme:dark){cr-icon{--iron-icon-fill-color:var(--cr-tooltip-icon-fill-color,var(--google-grey-500))}}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/policy/cr_tooltip_icon.html.js
function getHtml$5() {
	return x`
<cr-icon id="indicator" tabindex="0" aria-label="${this.iconAriaLabel}"
    aria-describedby="tooltip" icon="${this.iconClass}" role="img">
</cr-icon>
<cr-tooltip id="tooltip"
    for="indicator" position="${this.tooltipPosition}"
    fit-to-visible-bounds part="tooltip">
  <slot name="tooltip-text">${this.tooltipText}</slot>
</cr-tooltip>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/policy/cr_tooltip_icon.js
var CrTooltipIconElement = class extends CrLitElement {
	static get is() {
		return "cr-tooltip-icon";
	}
	static get styles() {
		return getCss$6();
	}
	render() {
		return getHtml$5.bind(this)();
	}
	static get properties() {
		return {
			iconAriaLabel: { type: String },
			iconClass: { type: String },
			tooltipText: { type: String },
			/** Position of tooltip popup related to the icon. */
			tooltipPosition: { type: String }
		};
	}
	#iconAriaLabel_accessor_storage = "";
	get iconAriaLabel() {
		return this.#iconAriaLabel_accessor_storage;
	}
	set iconAriaLabel(value) {
		this.#iconAriaLabel_accessor_storage = value;
	}
	#iconClass_accessor_storage = "";
	get iconClass() {
		return this.#iconClass_accessor_storage;
	}
	set iconClass(value) {
		this.#iconClass_accessor_storage = value;
	}
	#tooltipText_accessor_storage = "";
	get tooltipText() {
		return this.#tooltipText_accessor_storage;
	}
	set tooltipText(value) {
		this.#tooltipText_accessor_storage = value;
	}
	#tooltipPosition_accessor_storage = "top";
	get tooltipPosition() {
		return this.#tooltipPosition_accessor_storage;
	}
	set tooltipPosition(value) {
		this.#tooltipPosition_accessor_storage = value;
	}
	getFocusableElement() {
		return this.$.indicator;
	}
};
customElements.define(CrTooltipIconElement.is, CrTooltipIconElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/policy/cr_policy_types.js
/**
* Possible policy indicators that can be shown in settings.
*/
var CrPolicyIndicatorType;
(function(CrPolicyIndicatorType) {
	CrPolicyIndicatorType["DEVICE_POLICY"] = "devicePolicy";
	CrPolicyIndicatorType["EXTENSION"] = "extension";
	CrPolicyIndicatorType["NONE"] = "none";
	CrPolicyIndicatorType["OWNER"] = "owner";
	CrPolicyIndicatorType["PRIMARY_USER"] = "primary_user";
	CrPolicyIndicatorType["RECOMMENDED"] = "recommended";
	CrPolicyIndicatorType["USER_POLICY"] = "userPolicy";
	CrPolicyIndicatorType["PARENT"] = "parent";
	CrPolicyIndicatorType["CHILD_RESTRICTION"] = "childRestriction";
})(CrPolicyIndicatorType || (CrPolicyIndicatorType = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/controls/cr_policy_pref_indicator.html.js
function getTemplate$25() {
	return Ke`<!--_html_template_start_-->    <style include="cr-hidden-style"></style>
    <cr-tooltip-icon id="tooltipIcon" hidden$="[[!indicatorVisible]]"
        tooltip-text="[[indicatorTooltip]]" icon-class="[[indicatorIcon]]"
        icon-aria-label="[[iconAriaLabel]]" exportparts="tooltip">
    </cr-tooltip-icon>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/controls/cr_policy_pref_indicator.js
var CrPolicyPrefIndicatorElement = class extends tn {
	static get is() {
		return "cr-policy-pref-indicator";
	}
	static get template() {
		return getTemplate$25();
	}
	static get properties() {
		return {
			iconAriaLabel: String,
			indicatorIcon: {
				type: String,
				computed: "getIndicatorIcon_(indicatorType)"
			},
			indicatorType: {
				type: String,
				value: CrPolicyIndicatorType.NONE,
				computed: "getIndicatorTypeForPref_(pref.*, associatedValue)"
			},
			indicatorTooltip: {
				type: String,
				computed: "getIndicatorTooltipForPref_(indicatorType, pref.*)"
			},
			indicatorVisible: {
				type: Boolean,
				computed: "getIndicatorVisible_(indicatorType)"
			},
			/**
			* Optional preference object associated with the indicator. Initialized
			* to null so that computed functions will get called if this is never
			* set.
			*/
			pref: Object,
			/**
			* Optional value for the preference value this indicator is associated
			* with. If this is set, no indicator will be shown if it is a member
			* of |pref.userSelectableValues| and is not |pref.recommendedValue|.
			*/
			associatedValue: Object
		};
	}
	/**
	* @return True if the indicator should be shown.
	*/
	getIndicatorVisible_(type) {
		return type !== CrPolicyIndicatorType.NONE;
	}
	/**
	* @return {string} The cr-icon icon name.
	*/
	getIndicatorIcon_(type) {
		switch (type) {
			case CrPolicyIndicatorType.EXTENSION: return "cr:extension";
			case CrPolicyIndicatorType.NONE: return "";
			case CrPolicyIndicatorType.PRIMARY_USER: return "cr:group";
			case CrPolicyIndicatorType.OWNER: return "cr:person";
			case CrPolicyIndicatorType.USER_POLICY:
			case CrPolicyIndicatorType.DEVICE_POLICY:
			case CrPolicyIndicatorType.RECOMMENDED: return "cr20:domain";
			case CrPolicyIndicatorType.PARENT:
			case CrPolicyIndicatorType.CHILD_RESTRICTION: return "cr20:kite";
			default: assertNotReached$1();
		}
	}
	/**
	* @param name The name associated with the indicator. See
	*     chrome.settingsPrivate.PrefObject.controlledByName
	* @param matches For RECOMMENDED only, whether the indicator
	*     value matches the recommended value.
	* @return The tooltip text for |type|.
	*/
	getIndicatorTooltip_(type, name, matches) {
		if (!window.CrPolicyStrings) return "";
		const CrPolicyStrings = window.CrPolicyStrings;
		switch (type) {
			case CrPolicyIndicatorType.EXTENSION: return name.length > 0 ? CrPolicyStrings.controlledSettingExtension.replace("$1", name) : CrPolicyStrings.controlledSettingExtensionWithoutName;
			case CrPolicyIndicatorType.USER_POLICY:
			case CrPolicyIndicatorType.DEVICE_POLICY: return CrPolicyStrings.controlledSettingPolicy;
			case CrPolicyIndicatorType.RECOMMENDED: return matches ? CrPolicyStrings.controlledSettingRecommendedMatches : CrPolicyStrings.controlledSettingRecommendedDiffers;
			case CrPolicyIndicatorType.PARENT: return CrPolicyStrings.controlledSettingParent;
			case CrPolicyIndicatorType.CHILD_RESTRICTION: return CrPolicyStrings.controlledSettingChildRestriction;
		}
		return "";
	}
	/**
	* @return The indicator type based on |pref| and |associatedValue|.
	*/
	getIndicatorTypeForPref_() {
		assert$1(this.pref);
		const { enforcement, userSelectableValues, controlledBy, recommendedValue } = this.pref;
		if (enforcement === chrome.settingsPrivate.Enforcement.RECOMMENDED) {
			if (this.associatedValue !== void 0 && this.associatedValue !== recommendedValue) return CrPolicyIndicatorType.NONE;
			return CrPolicyIndicatorType.RECOMMENDED;
		}
		if (enforcement === chrome.settingsPrivate.Enforcement.ENFORCED) {
			if (userSelectableValues !== void 0) {
				if (recommendedValue && this.associatedValue === recommendedValue) return CrPolicyIndicatorType.RECOMMENDED;
				else if (userSelectableValues.includes(this.associatedValue)) return CrPolicyIndicatorType.NONE;
			}
			switch (controlledBy) {
				case chrome.settingsPrivate.ControlledBy.EXTENSION: return CrPolicyIndicatorType.EXTENSION;
				case chrome.settingsPrivate.ControlledBy.PRIMARY_USER: return CrPolicyIndicatorType.PRIMARY_USER;
				case chrome.settingsPrivate.ControlledBy.OWNER: return CrPolicyIndicatorType.OWNER;
				case chrome.settingsPrivate.ControlledBy.USER_POLICY: return CrPolicyIndicatorType.USER_POLICY;
				case chrome.settingsPrivate.ControlledBy.DEVICE_POLICY: return CrPolicyIndicatorType.DEVICE_POLICY;
				case chrome.settingsPrivate.ControlledBy.PARENT: return CrPolicyIndicatorType.PARENT;
				case chrome.settingsPrivate.ControlledBy.CHILD_RESTRICTION: return CrPolicyIndicatorType.CHILD_RESTRICTION;
			}
		}
		if (enforcement === chrome.settingsPrivate.Enforcement.PARENT_SUPERVISED) return CrPolicyIndicatorType.PARENT;
		return CrPolicyIndicatorType.NONE;
	}
	/**
	* @return The tooltip text for |indicatorType|.
	*/
	getIndicatorTooltipForPref_() {
		if (!this.pref) return "";
		const matches = this.pref && this.pref.value === this.pref.recommendedValue;
		return this.getIndicatorTooltip_(this.indicatorType, this.pref.controlledByName || "", matches);
	}
	getFocusableElement() {
		return this.$.tooltipIcon.getFocusableElement();
	}
};
customElements.define(CrPolicyPrefIndicatorElement.is, CrPolicyPrefIndicatorElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button_mixin.js
var CrRadioButtonMixin$1 = d$2((superClass) => {
	class CrRadioButtonMixin extends superClass {
		static get properties() {
			return {
				checked: {
					type: Boolean,
					reflectToAttribute: true,
					value: false
				},
				disabled: {
					type: Boolean,
					reflectToAttribute: true,
					notify: true,
					value: false
				},
				/**
				* Whether the radio button should be focusable or not. Toggling
				* this property sets the corresponding tabindex of the button
				* itself as well as any links in the button description.
				*/
				focusable: {
					type: Boolean,
					observer: "onFocusableChanged_",
					value: false
				},
				hideLabelText: {
					type: Boolean,
					reflectToAttribute: true,
					value: false
				},
				label: {
					type: String,
					value: ""
				},
				name: {
					type: String,
					notify: true,
					reflectToAttribute: true
				},
				/**
				* Holds the tabIndex for the radio button.
				*/
				buttonTabIndex_: {
					type: Number,
					computed: "getTabIndex_(focusable)"
				}
			};
		}
		connectedCallback() {
			super.connectedCallback();
			this.addEventListener("blur", this.hideRipple_.bind(this));
			this.addEventListener("up", this.hideRipple_.bind(this));
		}
		focus() {
			const button = this.shadowRoot.querySelector("#button");
			assert$1(button);
			button.focus();
		}
		getPaperRipple() {
			assertNotReached$1();
		}
		hideRipple_() {
			this.getPaperRipple().clear();
		}
		onFocusableChanged_() {
			this.querySelectorAll("a").forEach((link) => {
				link.tabIndex = this.checked ? 0 : -1;
			});
		}
		getAriaChecked_() {
			return this.checked ? "true" : "false";
		}
		getAriaDisabled_() {
			return this.disabled ? "true" : "false";
		}
		getTabIndex_() {
			return this.focusable ? 0 : -1;
		}
		/**
		* When shift-tab is pressed, first bring the focus to the host
		* element. This accomplishes 2 things:
		* 1) Host doesn't get focused when the browser moves the focus
		*    backward.
		* 2) focus now escaped the shadow-dom of this element, so that
		*    it'll correctly obey non-zero tabindex ordering of the
		*    containing document.
		*/
		onInputKeydown_(e) {
			if (e.shiftKey && e.key === "Tab") this.focus();
		}
	}
	return CrRadioButtonMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/controls/pref_control_mixin.js
/**
* Tracks the initialization of a specified preference and logs an error if the
* pref is not defined after prefs have been fetched.
*/
var PrefControlMixin = dedupingMixin((superClass) => {
	class PrefControlMixin extends superClass {
		static get properties() {
			return { 
			/** The Preference object being tracked. */
pref: {
				type: Object,
				notify: true,
				observer: "validatePref_"
			} };
		}
		connectedCallback() {
			super.connectedCallback();
			this.validatePref_();
		}
		/**
		* Logs an error once prefs are initialized if the tracked pref is not
		* found.
		*/
		validatePref_() {
			CrSettingsPrefs.initialized.then(() => {
				if (this.pref === void 0) console.error(this.getErrorInfo("not found"));
				else if (typeof this.pref === "string") console.error(this.getErrorInfo("incorrect type string"));
				else if (this.pref.enforcement === chrome.settingsPrivate.Enforcement.PARENT_SUPERVISED) console.error("PARENT_SUPERVISED is not enforced by pref controls");
			});
		}
		/**
		* Produce an error message with additional information about the
		* element and host causing the error.
		*/
		getErrorInfo(message) {
			let error = `Pref error [${message}] for element ${this.tagName}`;
			if (this.id) error += `#${this.id}`;
			error += ` in ${this.getRootNode().host.tagName}`;
			return error;
		}
	}
	return PrefControlMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/prefs/pref_util.js
/** @fileoverview Utility functions to help use prefs in Polymer controls. */
/**
* Converts a string value to a type corresponding to the given preference.
*/
function stringToPrefValue(value, pref) {
	switch (pref.type) {
		case chrome.settingsPrivate.PrefType.BOOLEAN: return value === "true";
		case chrome.settingsPrivate.PrefType.NUMBER:
			const n = parseFloat(value);
			if (isNaN(n)) {
				console.error("Argument to stringToPrefValue for number pref was unparsable: " + value);
				return;
			}
			return n;
		case chrome.settingsPrivate.PrefType.STRING:
		case chrome.settingsPrivate.PrefType.URL: return value;
		default: assertNotReached("No conversion from string to " + pref.type + " pref");
	}
}
/**
* Returns the value of the pref as a string.
*/
function prefToString(pref) {
	switch (pref.type) {
		case chrome.settingsPrivate.PrefType.BOOLEAN:
		case chrome.settingsPrivate.PrefType.NUMBER: return pref.value.toString();
		case chrome.settingsPrivate.PrefType.STRING:
		case chrome.settingsPrivate.PrefType.URL: return pref.value;
		default: assertNotReached("No conversion from " + pref.type + " pref to string");
	}
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/controlled_radio_button.html.js
function getTemplate$24() {
	return Ke`<!--_html_template_start_--><style include="cr-radio-button-style">:host([disabled]){opacity:1}:host([disabled]) .disc-wrapper,:host([disabled]) #labelWrapper{opacity:var(--cr-disabled-opacity)}cr-policy-pref-indicator{margin-inline-start:var(--cr-controlled-by-spacing);pointer-events:all}</style>

<div
    aria-checked$="[[getAriaChecked_(checked)]]"
    aria-describedby="slotted-content"
    aria-disabled$="[[getAriaDisabled_(disabled)]]"
    aria-labelledby="label"
    class="disc-wrapper"
    id="button"
    part="disc"
    role="radio"
    tabindex$="[[buttonTabIndex_]]"
    on-keydown="onInputKeydown_">
  <div class="disc-border"></div>
  <div class="disc"></div>
  <div id="overlay"></div>
</div>

<div id="labelWrapper" part="labelWrapper">
  <span id="label" hidden$="[[!label]]">[[label]]</span>
  <span id="slotted-content">
    <slot></slot>
  </span>
</div>

<slot name="additional-content"></slot>

<template is="dom-if" if="[[showIndicator_(disabled, name, pref.*)]]">
  <cr-policy-pref-indicator part="policy-indicator" pref="[[pref]]"
      on-click="onIndicatorClick_" icon-aria-label="[[label]]">
  </cr-policy-pref-indicator>
</template><!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/controlled_radio_button.js
var ControlledRadioButtonElementBase = CrRippleMixinPolymer(CrRadioButtonMixin$1(PrefControlMixin(tn)));
var ControlledRadioButtonElement = class extends ControlledRadioButtonElementBase {
	static get is() {
		return "controlled-radio-button";
	}
	static get template() {
		return getTemplate$24();
	}
	static get observers() {
		return ["updateDisabled_(pref.enforcement)"];
	}
	getPaperRipple() {
		return this.getRipple();
	}
	createRipple() {
		this.rippleContainer = this.shadowRoot.querySelector(".disc-wrapper");
		const ripple = super.createRipple();
		ripple.setAttribute("recenters", "");
		ripple.classList.add("circle");
		return ripple;
	}
	updateDisabled_() {
		this.disabled = this.pref.enforcement === chrome.settingsPrivate.Enforcement.ENFORCED;
	}
	showIndicator_() {
		if (!this.disabled) return false;
		assert$1(this.pref);
		return this.name === prefToString(this.pref);
	}
	onIndicatorClick_(e) {
		e.preventDefault();
		e.stopPropagation();
	}
};
customElements.define(ControlledRadioButtonElement.is, ControlledRadioButtonElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/focus_outline_manager.js
/**
* The class name to set on the document element.
*/
var CLASS_NAME = "focus-outline-visible";
var docsToManager = /* @__PURE__ */ new Map();
/**
* This class sets a CSS class name on the HTML element of |doc| when the user
* presses a key. It removes the class name when the user clicks anywhere.
*
* This allows you to write CSS like this:
*
* html.focus-outline-visible my-element:focus {
*   outline: 5px auto -webkit-focus-ring-color;
* }
*
* And the outline will only be shown if the user uses the keyboard to get to
* it.
*
*/
var FocusOutlineManager = class FocusOutlineManager {
	focusByKeyboard_ = true;
	classList_;
	/**
	* @param doc The document to attach the focus outline manager to.
	*/
	constructor(doc) {
		this.classList_ = doc.documentElement.classList;
		doc.addEventListener("keydown", (e) => this.onEvent_(true, e), true);
		doc.addEventListener("mousedown", (e) => this.onEvent_(false, e), true);
		this.updateVisibility();
	}
	onEvent_(focusByKeyboard, e) {
		if (this.focusByKeyboard_ === focusByKeyboard) return;
		if (e instanceof KeyboardEvent && e.repeat) return;
		this.focusByKeyboard_ = focusByKeyboard;
		this.updateVisibility();
	}
	updateVisibility() {
		this.visible = this.focusByKeyboard_;
	}
	/**
	* Whether the focus outline should be visible.
	*/
	set visible(visible) {
		this.classList_.toggle(CLASS_NAME, visible);
	}
	get visible() {
		return this.classList_.contains(CLASS_NAME);
	}
	/**
	* Gets a per document singleton focus outline manager.
	* @param doc The document to get the |FocusOutlineManager| for.
	* @return The per document singleton focus outline manager.
	*/
	static forDocument(doc) {
		let manager = docsToManager.get(doc);
		if (!manager) {
			manager = new FocusOutlineManager(doc);
			docsToManager.set(doc, manager);
		}
		return manager;
	}
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_button/cr_button.css.js
var instance$23 = null;
function getCss$5() {
	return instance$23 || (instance$23 = [...[getCss$13()], i$4`:host{--cr-button-background-color:transparent;--cr-button-border-color:var(--color-button-border,var(--cr-fallback-color-tonal-outline));--cr-button-text-color:var(--color-button-foreground,var(--cr-fallback-color-primary));--cr-button-ripple-opacity:1;--cr-button-ripple-color:var(--cr-active-background-color);--cr-button-disabled-background-color:transparent;--cr-button-disabled-border-color:var(--color-button-border-disabled,var(--cr-fallback-color-disabled-background));--cr-button-disabled-text-color:var(--color-button-foreground-disabled,var(--cr-fallback-color-disabled-foreground));flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:5.14em;height:var(--cr-button-height);padding:8px 16px;outline-width:0;overflow:hidden;position:relative;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;border:var(--cr-button-border,1px solid var(--cr-button-border-color));border-radius:100px;background:var(--cr-button-background-color);color:var(--cr-button-text-color);font-weight:500;line-height:20px;isolation:isolate}:host(.action-button){--cr-button-background-color:var(--color-button-background-prominent,var(--cr-fallback-color-primary));--cr-button-text-color:var(--color-button-foreground-prominent,var(--cr-fallback-color-on-primary));--cr-button-ripple-color:var(--cr-active-on-primary-background-color);--cr-button-border:none;--cr-button-disabled-background-color:var(--color-button-background-prominent-disabled,var(--cr-fallback-color-disabled-background));--cr-button-disabled-text-color:var(--color-button-foreground-disabled,var(--cr-fallback-color-disabled-foreground));--cr-button-disabled-border:none}:host(.tonal-button),:host(.floating-button){--cr-button-background-color:var(--color-button-background-tonal,var(--cr-fallback-color-secondary-container));--cr-button-text-color:var(--color-button-foreground-tonal,var(--cr-fallback-color-on-tonal-container));--cr-button-border:none;--cr-button-disabled-background-color:var(--color-button-background-tonal-disabled,var(--cr-fallback-color-disabled-background));--cr-button-disabled-text-color:var(--color-button-foreground-disabled,var(--cr-fallback-color-disabled-foreground));--cr-button-disabled-border:none}@media (forced-colors:active){:host{forced-color-adjust:none}}:host(.floating-button){border-radius:8px;height:40px;transition:box-shadow 80ms linear}:host(.floating-button:hover){box-shadow:var(--cr-elevation-3)}:host([has-prefix-icon_]),:host([has-suffix-icon_]){--iron-icon-height:20px;--iron-icon-width:20px;--icon-block-padding-large:16px;--icon-block-padding-small:12px;gap:8px;padding-block-end:8px;padding-block-start:8px}:host([has-prefix-icon_]){padding-inline-end:var(--icon-block-padding-large);padding-inline-start:var(--icon-block-padding-small)}:host([has-suffix-icon_]){padding-inline-end:var(--icon-block-padding-small);padding-inline-start:var(--icon-block-padding-large)}:host-context(.focus-outline-visible):host(:focus){box-shadow:none;outline:2px solid var(--cr-focus-outline-color);outline-offset:2px}#background{border-radius:inherit;inset:0;pointer-events:none;position:absolute;z-index:0}#content{display:inline}#hoverBackground{content:'';display:none;inset:0;pointer-events:none;position:absolute;z-index:1}:host(:hover) #hoverBackground{background:var(--cr-hover-background-color);display:block}:host(.action-button:hover) #hoverBackground{background:var(--cr-hover-on-prominent-background-color)}:host([disabled]){background:var(--cr-button-disabled-background-color);border:var(--cr-button-disabled-border,1px solid var(--cr-button-disabled-border-color));color:var(--cr-button-disabled-text-color);cursor:auto;pointer-events:none}:host(.cancel-button){margin-inline-end:8px}:host(.action-button),:host(.cancel-button){line-height:154%}#ink{color:var(--cr-button-ripple-color);--paper-ripple-opacity:var(--cr-button-ripple-opacity)}#hoverBackground,cr-ripple{z-index:1}#content,::slotted(*){z-index:2}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_button/cr_button.html.js
function getHtml$4() {
	return x`
<div id="background"></div>
<slot id="prefixIcon" name="prefix-icon"
    @slotchange="${this.onPrefixIconSlotChanged_}">
</slot>
<span id="content"><slot></slot></span>
<slot id="suffixIcon" name="suffix-icon"
    @slotchange="${this.onSuffixIconSlotChanged_}">
</slot>
<div id="hoverBackground" part="hoverBackground"></div>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_button/cr_button.js
/**
* @fileoverview 'cr-button' is a button which displays slotted elements. It can
* be interacted with like a normal button using click as well as space and
* enter to effectively click the button and fire a 'click' event. It can also
* style an icon inside of the button with the [has-icon] attribute.
*/
var CrButtonElementBase = CrRippleMixin(CrLitElement);
var CrButtonElement = class extends CrButtonElementBase {
	static get is() {
		return "cr-button";
	}
	static get styles() {
		return getCss$5();
	}
	render() {
		return getHtml$4.bind(this)();
	}
	static get properties() {
		return {
			disabled: {
				type: Boolean,
				reflect: true
			},
			hasPrefixIcon_: {
				type: Boolean,
				reflect: true
			},
			hasSuffixIcon_: {
				type: Boolean,
				reflect: true
			}
		};
	}
	#disabled_accessor_storage = false;
	get disabled() {
		return this.#disabled_accessor_storage;
	}
	set disabled(value) {
		this.#disabled_accessor_storage = value;
	}
	#hasPrefixIcon__accessor_storage = false;
	get hasPrefixIcon_() {
		return this.#hasPrefixIcon__accessor_storage;
	}
	set hasPrefixIcon_(value) {
		this.#hasPrefixIcon__accessor_storage = value;
	}
	#hasSuffixIcon__accessor_storage = false;
	get hasSuffixIcon_() {
		return this.#hasSuffixIcon__accessor_storage;
	}
	set hasSuffixIcon_(value) {
		this.#hasSuffixIcon__accessor_storage = value;
	}
	/**
	* It is possible to activate a tab when the space key is pressed down. When
	* this element has focus, the keyup event for the space key should not
	* perform a 'click'. |spaceKeyDown_| tracks when a space pressed and
	* handled by this element. Space keyup will only result in a 'click' when
	* |spaceKeyDown_| is true. |spaceKeyDown_| is set to false when element
	* loses focus.
	*/
	spaceKeyDown_ = false;
	timeoutIds_ = /* @__PURE__ */ new Set();
	constructor() {
		super();
		this.addEventListener("blur", this.onBlur_.bind(this));
		this.addEventListener("click", this.onClick_.bind(this));
		this.addEventListener("keydown", this.onKeyDown_.bind(this));
		this.addEventListener("keyup", this.onKeyUp_.bind(this));
		this.ensureRippleOnPointerdown();
	}
	firstUpdated() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "button");
		if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
		FocusOutlineManager.forDocument(document);
	}
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("disabled")) {
			this.setAttribute("aria-disabled", this.disabled ? "true" : "false");
			this.disabledChanged_(this.disabled, changedProperties.get("disabled"));
		}
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		this.timeoutIds_.forEach(clearTimeout);
		this.timeoutIds_.clear();
	}
	setTimeout_(fn, delay) {
		if (!this.isConnected) return;
		const id = setTimeout(() => {
			this.timeoutIds_.delete(id);
			fn();
		}, delay);
		this.timeoutIds_.add(id);
	}
	disabledChanged_(newValue, oldValue) {
		if (!newValue && oldValue === void 0) return;
		if (this.disabled) this.blur();
		this.setAttribute("tabindex", String(this.disabled ? -1 : 0));
	}
	onBlur_() {
		this.spaceKeyDown_ = false;
		this.setTimeout_(() => this.getRipple().uiUpAction(), 100);
	}
	onClick_(e) {
		if (this.disabled) e.stopImmediatePropagation();
	}
	onPrefixIconSlotChanged_() {
		this.hasPrefixIcon_ = this.$.prefixIcon.assignedElements().length > 0;
	}
	onSuffixIconSlotChanged_() {
		this.hasSuffixIcon_ = this.$.suffixIcon.assignedElements().length > 0;
	}
	onKeyDown_(e) {
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		e.stopPropagation();
		if (e.repeat) return;
		this.getRipple().uiDownAction();
		if (e.key === "Enter") {
			this.click();
			this.setTimeout_(() => this.getRipple().uiUpAction(), 100);
		} else if (e.key === " ") this.spaceKeyDown_ = true;
	}
	onKeyUp_(e) {
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		e.stopPropagation();
		if (this.spaceKeyDown_ && e.key === " ") {
			this.spaceKeyDown_ = false;
			this.click();
			this.getRipple().uiUpAction();
		}
	}
};
customElements.define(CrButtonElement.is, CrButtonElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/load_time_data.js
/**
* @fileoverview This file defines a singleton which provides access to all data
* that is available as soon as the page's resources are loaded (before DOM
* content has finished loading). This data includes both localized strings and
* any data that is important to have ready from a very early stage (e.g. things
* that must be displayed right away).
*
* Note that loadTimeData is not guaranteed to be consistent between page
* refreshes (https://crbug.com/740629) and should not contain values that might
* change if the page is re-opened later.
*/
var LoadTimeData = class {
	data_ = null;
	/**
	* Sets the backing object.
	*
	* Note that there is no getter for |data_| to discourage abuse of the form:
	*
	*     var value = loadTimeData.data()['key'];
	*/
	set data(value) {
		assert$1(!this.data_, "Re-setting data.");
		this.data_ = value;
	}
	/**
	* @param id An ID of a value that might exist.
	* @return True if |id| is a key in the dictionary.
	*/
	valueExists(id) {
		assert$1(this.data_, "No data. Did you remember to include strings.js?");
		return id in this.data_;
	}
	/**
	* Fetches a value, expecting that it exists.
	* @param id The key that identifies the desired value.
	* @return The corresponding value.
	*/
	getValue(id) {
		assert$1(this.data_, "No data. Did you remember to include strings.js?");
		const value = this.data_[id];
		assert$1(typeof value !== "undefined", "Could not find value for " + id);
		return value;
	}
	/**
	* As above, but also makes sure that the value is a string.
	* @param id The key that identifies the desired string.
	* @return The corresponding string value.
	*/
	getString(id) {
		const value = this.getValue(id);
		assert$1(typeof value === "string", `[${value}] (${id}) is not a string`);
		return value;
	}
	/**
	* Returns a formatted localized string where $1 to $9 are replaced by the
	* second to the tenth argument.
	* @param id The ID of the string we want.
	* @param args The extra values to include in the formatted output.
	* @return The formatted string.
	*/
	getStringF(id, ...args) {
		const value = this.getString(id);
		if (!value) return "";
		return this.substituteString(value, ...args);
	}
	/**
	* Returns a formatted localized string where $1 to $9 are replaced by the
	* second to the tenth argument. Any standalone $ signs must be escaped as
	* $$.
	* @param label The label to substitute through. This is not an resource ID.
	* @param args The extra values to include in the formatted output.
	* @return The formatted string.
	*/
	substituteString(label, ...args) {
		return label.replace(/\$(.|$|\n)/g, function(m) {
			assert$1(m.match(/\$[$1-9]/), "Unescaped $ found in localized string.");
			if (m === "$$") return "$";
			const substitute = args[Number(m[1]) - 1];
			if (substitute === void 0 || substitute === null) return "";
			return substitute.toString();
		});
	}
	/**
	* Returns a formatted string where $1 to $9 are replaced by the second to
	* tenth argument, split apart into a list of pieces describing how the
	* substitution was performed. Any standalone $ signs must be escaped as $$.
	* @param label A localized string to substitute through.
	*     This is not an resource ID.
	* @param args The extra values to include in the formatted output.
	* @return The formatted string pieces.
	*/
	getSubstitutedStringPieces(label, ...args) {
		return (label.match(/(\$[1-9])|(([^$]|\$([^1-9]|$))+)/g) || []).map(function(p) {
			if (!p.match(/^\$[1-9]$/)) {
				assert$1((p.match(/\$/g) || []).length % 2 === 0, "Unescaped $ found in localized string.");
				return {
					value: p.replace(/\$\$/g, "$"),
					arg: null
				};
			}
			const substitute = args[Number(p[1]) - 1];
			if (substitute === void 0 || substitute === null) return {
				value: "",
				arg: p
			};
			return {
				value: substitute.toString(),
				arg: p
			};
		});
	}
	/**
	* As above, but also makes sure that the value is a boolean.
	* @param id The key that identifies the desired boolean.
	* @return The corresponding boolean value.
	*/
	getBoolean(id) {
		const value = this.getValue(id);
		assert$1(typeof value === "boolean", `[${value}] (${id}) is not a boolean`);
		return value;
	}
	/**
	* As above, but also makes sure that the value is an integer.
	* @param id The key that identifies the desired number.
	* @return The corresponding number value.
	*/
	getInteger(id) {
		const value = this.getValue(id);
		assert$1(typeof value === "number", `[${value}] (${id}) is not a number`);
		assert$1(value === Math.floor(value), "Number isn't integer: " + value);
		return value;
	}
	/**
	* Override values in loadTimeData with the values found in |replacements|.
	* @param replacements The dictionary object of keys to replace.
	*/
	overrideValues(replacements) {
		assert$1(typeof replacements === "object", "Replacements must be a dictionary object.");
		assert$1(this.data_, "Data must exist before being overridden");
		for (const key in replacements) this.data_[key] = replacements[key];
	}
	/**
	* Reset loadTimeData's data. Should only be used in tests.
	* @param newData The data to restore to, when null restores to unset state.
	*/
	resetForTesting(newData = null) {
		this.data_ = newData;
	}
	/**
	* @return Whether loadTimeData.data has been set.
	*/
	isInitialized() {
		return this.data_ !== null;
	}
};
var loadTimeData$1 = new LoadTimeData();
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/open_window_proxy.js
var OpenWindowProxyImpl$1 = class OpenWindowProxyImpl$1 {
	openUrl(url) {
		window.open(url);
	}
	static getInstance() {
		return instance$22 || (instance$22 = new OpenWindowProxyImpl$1());
	}
	static setInstance(obj) {
		instance$22 = obj;
	}
};
var instance$22 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/extension_control_browser_proxy.js
var ExtensionControlBrowserProxyImpl = class ExtensionControlBrowserProxyImpl {
	disableExtension(extensionId) {
		chrome.send("disableExtension", [extensionId]);
	}
	manageExtension(extensionId) {
		window.open("astro://extensions?id=" + extensionId);
	}
	static getInstance() {
		return instance$21 || (instance$21 = new ExtensionControlBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$21 = obj;
	}
};
var instance$21 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/controls/extension_controlled_indicator.html.js
function getTemplate$23() {
	return Ke`<!--_html_template_start_--><style

>:host{align-items:center;display:flex;margin-inline-start:36px;min-height:var(--cr-section-min-height)}img{margin-inline-end:16px}iron-icon[icon='cr:open-in-new']{fill:currentColor;height:var(--cr-icon-size);width:var(--cr-icon-size)}#disable{margin-inline-start:8px}:host>span{flex:1;margin-inline-end:8px}</style>
<img role="presentation" src="astro://extension-icon/[[extensionId]]/20/1">
<span>[[getLabel_(extensionName)]]</span>
<cr-button id="manage" on-click="onManageClick_">
  $i18n{manage}
  <cr-icon icon="cr:open-in-new" slot="suffix-icon"></cr-icon>
</cr-button>
<template is="dom-if" if="[[extensionCanBeDisabled]]" restamp>
  <cr-button id="disable" on-click="onDisableClick_">$i18n{disable}</cr-button>
</template>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/controls/extension_controlled_indicator.js
var ExtensionControlledIndicatorElement = class extends tn {
	static get is() {
		return "extension-controlled-indicator";
	}
	static get template() {
		return getTemplate$23();
	}
	static get properties() {
		return {
			extensionCanBeDisabled: Boolean,
			extensionId: String,
			extensionName: String,
			extensionNameOnlyInLabel: Boolean
		};
	}
	getLabel_() {
		if (this.extensionNameOnlyInLabel === true) return this.extensionName;
		return loadTimeData$1.getStringF("controlledByExtension", this.extensionName);
	}
	onManageClick_() {
		const manageUrl = "astro://extensions/?id=" + this.extensionId;
		OpenWindowProxyImpl$1.getInstance().openUrl(manageUrl);
	}
	onDisableClick_() {
		assert$1(this.extensionCanBeDisabled);
		ExtensionControlBrowserProxyImpl.getInstance().disableExtension(this.extensionId);
		this.dispatchEvent(new CustomEvent("extension-disable", {
			bubbles: true,
			composed: true
		}));
	}
};
customElements.define(ExtensionControlledIndicatorElement.is, ExtensionControlledIndicatorElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button_style_lit.css.js
var instance$20 = null;
function getCss$4() {
	return instance$20 || (instance$20 = [...[], i$4`:host{--cr-radio-button-checked-color:var(--color-radio-button-foreground-checked,var(--cr-fallback-color-primary));--cr-radio-button-checked-ripple-color:var(--cr-active-background-color);--cr-radio-button-ink-size:32px;--cr-radio-button-size:16px;--cr-radio-button-unchecked-color:var(--color-radio-button-foreground-unchecked,var(--cr-fallback-color-outline));--cr-radio-button-unchecked-ripple-color:var(--cr-active-background-color);--ink-to-circle:calc((var(--cr-radio-button-ink-size) - var(--cr-radio-button-size)) / 2);align-items:center;display:flex;flex-shrink:0;gap:var(--cr-radio-button-label-spacing,20px);outline:none}@media (prefers-color-scheme:dark){:host{--cr-radio-button-checked-color:var(--google-blue-300);--cr-radio-button-checked-ripple-color:rgba(var(--google-blue-300-rgb),.4);--cr-radio-button-unchecked-color:var(--google-grey-500);--cr-radio-button-unchecked-ripple-color:rgba(var(--google-grey-300-rgb),.4)}}@media (forced-colors:active){:host{--cr-radio-button-checked-color:SelectedItem;forced-color-adjust:none}}:host([disabled]){opacity:1;pointer-events:none;--cr-radio-button-checked-color:var(--color-radio-foreground-disabled,var(--cr-fallback-color-disabled-foreground));--cr-radio-button-unchecked-color:var(--color-radio-foreground-disabled,var(--cr-fallback-color-disabled-foreground))}:host(:not([disabled])){cursor:pointer}:host(.label-first){flex-direction:row-reverse}#labelWrapper{flex:1}:host([disabled]) #labelWrapper{opacity:var(--cr-disabled-opacity)}#label{color:inherit}:host([hide-label-text]) #label{clip:rect(0,0,0,0);display:block;position:fixed}.disc-border,.disc,.disc-wrapper,cr-ripple,paper-ripple{border-radius:50%}.disc-wrapper{height:var(--cr-radio-button-size);margin-block-start:var(--cr-radio-button-disc-margin-block-start,0);position:relative;width:var(--cr-radio-button-size)}.disc-border,.disc{box-sizing:border-box;height:var(--cr-radio-button-size);width:var(--cr-radio-button-size)}.disc-border{border:2px solid var(--cr-radio-button-unchecked-color)}:host([checked]) .disc-border{border-color:var(--cr-radio-button-checked-color)}#button:focus{outline:none}.disc{background-color:transparent;position:absolute;top:0;transform:scale(0);transition:border-color 200ms,transform 200ms}:host([checked]) .disc{background-color:var(--cr-radio-button-checked-color);transform:scale(0.5)}#overlay{border-radius:50%;box-sizing:border-box;display:none;height:var(--cr-radio-button-ink-size);left:50%;pointer-events:none;position:absolute;top:50%;transform:translate(-50%,-50%);width:var(--cr-radio-button-ink-size)}#button:hover #overlay{background-color:var(--cr-hover-background-color);display:block}#button:focus-visible #overlay{border:2px solid var(--cr-focus-outline-color);display:block}cr-ripple,paper-ripple{--paper-ripple-opacity:1;color:var(--cr-radio-button-unchecked-ripple-color);height:var(--cr-radio-button-ink-size);left:calc(-1 * var(--ink-to-circle));pointer-events:none;position:absolute;top:calc(-1 * var(--ink-to-circle));transition:color linear 80ms;width:var(--cr-radio-button-ink-size)}:host-context([dir=rtl]) cr-ripple,:host-context([dir=rtl]) paper-ripple{left:auto;right:calc(-1 * var(--ink-to-circle))}:host([checked]) cr-ripple,:host([checked]) paper-ripple{color:var(--cr-radio-button-checked-ripple-color)}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button.css.js
var instance$19 = null;
function getCss$3() {
	return instance$19 || (instance$19 = [...[getCss$4(), getCss$13()], i$4``]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button.html.js
function getHtml$3() {
	return x`
<div aria-checked="${this.getAriaChecked()}"
    aria-describedby="slotted-content"
    aria-disabled="${this.getAriaDisabled()}"
    aria-labelledby="label"
    class="disc-wrapper"
    id="button"
    role="radio"
    tabindex="${this.getButtonTabIndex()}"
    @keydown="${this.onInputKeydown}">
  <div class="disc-border"></div>
  <div class="disc"></div>
  <div id="overlay"></div>
</div>

<div id="labelWrapper">
  <span id="label" ?hidden="${!this.label}" aria-hidden="true">
    ${this.label}
  </span>
  <span id="slotted-content">
    <slot></slot>
  </span>
</div>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button_mixin_lit.js
var CrRadioButtonMixinLit = (superClass) => {
	class CrRadioButtonMixinLit extends superClass {
		static get properties() {
			return {
				checked: {
					type: Boolean,
					reflect: true
				},
				disabled: {
					type: Boolean,
					reflect: true,
					notify: true
				},
				/**
				* Whether the radio button should be focusable or not. Toggling
				* this property sets the corresponding tabindex of the button
				* itself as well as any links in the button description.
				*/
				focusable: { type: Boolean },
				hideLabelText: {
					type: Boolean,
					reflect: true
				},
				label: { type: String },
				name: {
					type: String,
					notify: true,
					reflect: true
				},
				/**
				* Holds the tabIndex for the radio button.
				*/
				ariaCheckedString: { type: String },
				ariaDisabledString: { type: String }
			};
		}
		#checked_accessor_storage = false;
		get checked() {
			return this.#checked_accessor_storage;
		}
		set checked(value) {
			this.#checked_accessor_storage = value;
		}
		#disabled_accessor_storage = false;
		get disabled() {
			return this.#disabled_accessor_storage;
		}
		set disabled(value) {
			this.#disabled_accessor_storage = value;
		}
		#focusable_accessor_storage = false;
		get focusable() {
			return this.#focusable_accessor_storage;
		}
		set focusable(value) {
			this.#focusable_accessor_storage = value;
		}
		#hideLabelText_accessor_storage = false;
		get hideLabelText() {
			return this.#hideLabelText_accessor_storage;
		}
		set hideLabelText(value) {
			this.#hideLabelText_accessor_storage = value;
		}
		#label_accessor_storage = "";
		get label() {
			return this.#label_accessor_storage;
		}
		set label(value) {
			this.#label_accessor_storage = value;
		}
		#name_accessor_storage;
		get name() {
			return this.#name_accessor_storage;
		}
		set name(value) {
			this.#name_accessor_storage = value;
		}
		noRipple = false;
		#ariaCheckedString_accessor_storage = "false";
		get ariaCheckedString() {
			return this.#ariaCheckedString_accessor_storage;
		}
		set ariaCheckedString(value) {
			this.#ariaCheckedString_accessor_storage = value;
		}
		#ariaDisabledString_accessor_storage = "false";
		get ariaDisabledString() {
			return this.#ariaDisabledString_accessor_storage;
		}
		set ariaDisabledString(value) {
			this.#ariaDisabledString_accessor_storage = value;
		}
		connectedCallback() {
			super.connectedCallback();
			if (!this.noRipple) {
				this.addEventListener("blur", this.hideRipple_.bind(this));
				this.addEventListener("up", this.hideRipple_.bind(this));
			}
		}
		updated(changedProperties) {
			super.updated(changedProperties);
			if (changedProperties.has("focusable")) this.querySelectorAll("a").forEach((link) => {
				link.tabIndex = this.checked ? 0 : -1;
			});
		}
		getAriaDisabled() {
			return this.disabled ? "true" : "false";
		}
		getAriaChecked() {
			return this.checked ? "true" : "false";
		}
		getButtonTabIndex() {
			return this.focusable ? 0 : -1;
		}
		focus() {
			const button = this.shadowRoot.querySelector("#button");
			assert$1(button);
			button.focus();
		}
		getRipple() {
			assertNotReached$1();
		}
		hideRipple_() {
			assert$1(!this.noRipple);
			this.getRipple().clear();
		}
		/**
		* When shift-tab is pressed, first bring the focus to the host
		* element. This accomplishes 2 things:
		* 1) Host doesn't get focused when the browser moves the focus
		*    backward.
		* 2) focus now escaped the shadow-dom of this element, so that
		*    it'll correctly obey non-zero tabindex ordering of the
		*    containing document.
		*/
		onInputKeydown(e) {
			if (e.shiftKey && e.key === "Tab") this.focus();
		}
	}
	return CrRadioButtonMixinLit;
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_button/cr_radio_button.js
var CrRadioButtonElementBase = CrRippleMixin(CrRadioButtonMixinLit(CrLitElement));
var CrRadioButtonElement = class extends CrRadioButtonElementBase {
	static get is() {
		return "cr-radio-button";
	}
	static get styles() {
		return getCss$3();
	}
	render() {
		return getHtml$3.bind(this)();
	}
	createRipple() {
		this.rippleContainer = this.shadowRoot.querySelector(".disc-wrapper");
		const ripple = super.createRipple();
		ripple.setAttribute("recenters", "");
		ripple.classList.add("circle");
		return ripple;
	}
};
customElements.define(CrRadioButtonElement.is, CrRadioButtonElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_group/cr_radio_group.css.js
var instance$18 = null;
function getCss$2() {
	return instance$18 || (instance$18 = [...[], i$4`:host{display:inline-block}:host ::slotted(*){padding:var(--cr-radio-group-item-padding,12px)}:host([disabled]){cursor:initial;pointer-events:none;user-select:none}:host([disabled]) ::slotted(*){opacity:var(--cr-disabled-opacity)}
`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_group/cr_radio_group.html.js
function getHtml$2() {
	return x`<slot></slot>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_radio_group/cr_radio_group.js
function isEnabled(radio) {
	return radio.matches(":not([disabled]):not([hidden])") && radio.style.display !== "none" && radio.style.visibility !== "hidden";
}
var CrRadioGroupElement = class extends CrLitElement {
	static get is() {
		return "cr-radio-group";
	}
	static get styles() {
		return getCss$2();
	}
	render() {
		return getHtml$2.bind(this)();
	}
	static get properties() {
		return {
			disabled: {
				type: Boolean,
				reflect: true
			},
			selected: {
				type: String,
				notify: true
			},
			selectableElements: { type: String },
			nestedSelectable: { type: Boolean },
			selectableRegExp_: { type: Object }
		};
	}
	#disabled_accessor_storage = false;
	get disabled() {
		return this.#disabled_accessor_storage;
	}
	set disabled(value) {
		this.#disabled_accessor_storage = value;
	}
	#selected_accessor_storage;
	get selected() {
		return this.#selected_accessor_storage;
	}
	set selected(value) {
		this.#selected_accessor_storage = value;
	}
	#selectableElements_accessor_storage = "cr-radio-button, cr-card-radio-button, controlled-radio-button";
	get selectableElements() {
		return this.#selectableElements_accessor_storage;
	}
	set selectableElements(value) {
		this.#selectableElements_accessor_storage = value;
	}
	#nestedSelectable_accessor_storage = false;
	get nestedSelectable() {
		return this.#nestedSelectable_accessor_storage;
	}
	set nestedSelectable(value) {
		this.#nestedSelectable_accessor_storage = value;
	}
	#selectableRegExp__accessor_storage = /* @__PURE__ */ new RegExp("");
	get selectableRegExp_() {
		return this.#selectableRegExp__accessor_storage;
	}
	set selectableRegExp_(value) {
		this.#selectableRegExp__accessor_storage = value;
	}
	buttons_ = null;
	buttonEventTracker_ = new EventTracker();
	deltaKeyMap_ = null;
	isRtl_ = false;
	populateBound_ = null;
	firstUpdated() {
		this.addEventListener("keydown", (e) => this.onKeyDown_(e));
		this.addEventListener("click", (e) => this.onClick_(e));
		if (!this.hasAttribute("role")) this.setAttribute("role", "radiogroup");
	}
	connectedCallback() {
		super.connectedCallback();
		this.isRtl_ = this.matches(":host-context([dir=rtl]) cr-radio-group");
		this.deltaKeyMap_ = /* @__PURE__ */ new Map([
			["ArrowDown", 1],
			["ArrowLeft", this.isRtl_ ? 1 : -1],
			["ArrowRight", this.isRtl_ ? -1 : 1],
			["ArrowUp", -1],
			["PageDown", 1],
			["PageUp", -1]
		]);
		this.populateBound_ = () => this.populate_();
		assert$1(this.populateBound_);
		this.shadowRoot.querySelector("slot").addEventListener("slotchange", this.populateBound_);
		this.populate_();
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		assert$1(this.populateBound_);
		this.shadowRoot.querySelector("slot").removeEventListener("slotchange", this.populateBound_);
		this.buttonEventTracker_.removeAll();
	}
	willUpdate(changedProperties) {
		super.willUpdate(changedProperties);
		if (changedProperties.has("selectableElements")) {
			const tags = this.selectableElements.split(", ").join("|");
			this.selectableRegExp_ = new RegExp(`^(${tags})$`, "i");
		}
	}
	updated(changedProperties) {
		if (changedProperties.has("nestedSelectable")) this.populate_();
		if (changedProperties.has("disabled") || changedProperties.has("selected")) this.update_();
		this.setAttribute("aria-disabled", `${this.disabled}`);
		super.updated(changedProperties);
	}
	focus() {
		if (this.disabled || !this.buttons_) return;
		const radio = this.buttons_.find((radio) => this.isButtonEnabledAndSelected_(radio));
		if (radio) radio.focus();
	}
	onKeyDown_(event) {
		if (this.disabled) return;
		if (event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
		const targetElement = event.target;
		if (!this.buttons_ || !this.buttons_.includes(targetElement)) return;
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault();
			this.select_(targetElement);
			return;
		}
		const enabledRadios = this.buttons_.filter(isEnabled);
		if (enabledRadios.length === 0) return;
		assert$1(this.deltaKeyMap_);
		let selectedIndex;
		const max = enabledRadios.length - 1;
		if (event.key === "Home") selectedIndex = 0;
		else if (event.key === "End") selectedIndex = max;
		else if (this.deltaKeyMap_.has(event.key)) {
			const delta = this.deltaKeyMap_.get(event.key);
			const lastSelection = enabledRadios.findIndex((radio) => radio.checked);
			selectedIndex = Math.max(0, lastSelection) + delta;
			if (selectedIndex > max) selectedIndex = 0;
			else if (selectedIndex < 0) selectedIndex = max;
		} else return;
		const radio = enabledRadios[selectedIndex];
		const name = `${radio.name}`;
		if (this.selected !== name) {
			event.preventDefault();
			event.stopPropagation();
			this.selected = name;
			radio.focus();
		}
	}
	onClick_(event) {
		const path = event.composedPath();
		if (path.some((target) => /^a$/i.test(target.tagName))) return;
		const target = path.find((n) => this.selectableRegExp_.test(n.tagName));
		if (target && this.buttons_ && this.buttons_.includes(target)) this.select_(target);
	}
	populate_() {
		const elements = this.shadowRoot.querySelector("slot").assignedElements({ flatten: true });
		this.buttons_ = Array.from(elements).flatMap((el) => {
			let result = [];
			if (el.matches(this.selectableElements)) result.push(el);
			if (this.nestedSelectable) result = result.concat(Array.from(el.querySelectorAll(this.selectableElements)));
			return result;
		});
		this.buttonEventTracker_.removeAll();
		this.buttons_.forEach((el) => {
			this.buttonEventTracker_.add(el, "disabled-changed", () => this.populate_());
			this.buttonEventTracker_.add(el, "name-changed", () => this.populate_());
		});
		this.update_();
	}
	select_(button) {
		if (!isEnabled(button)) return;
		const name = `${button.name}`;
		if (this.selected !== name) this.selected = name;
	}
	isButtonEnabledAndSelected_(button) {
		return !this.disabled && button.checked && isEnabled(button);
	}
	update_() {
		if (!this.buttons_) return;
		let noneMadeFocusable = true;
		this.buttons_.forEach((radio) => {
			radio.checked = this.selected !== void 0 && `${radio.name}` === `${this.selected}`;
			const disabled = this.disabled || !isEnabled(radio);
			if (radio.checked && !disabled) {
				radio.focusable = true;
				noneMadeFocusable = false;
			} else radio.focusable = false;
			radio.setAttribute("aria-disabled", `${disabled}`);
		});
		if (noneMadeFocusable && !this.disabled) {
			const radio = this.buttons_.find(isEnabled);
			if (radio) radio.focusable = true;
		}
	}
};
customElements.define(CrRadioGroupElement.is, CrRadioGroupElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_radio_group.html.js
function getTemplate$22() {
	return Ke`<!--_html_template_start_--><style>cr-radio-group{width:100%}:host([is-horizontal]) cr-radio-group{display:flex}
</style>
<cr-radio-group selected="[[selected]]"
    on-selected-changed="onSelectedChanged_"
    aria-label$="[[groupAriaLabel]]"
    selectable-elements="[[selectableElements]]"
    nested-selectable="[[nestedSelectable]]">
  <slot></slot>
</cr-radio-group>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_radio_group.js
var SettingsRadioGroupElementBase = PrefControlMixin(tn);
var SettingsRadioGroupElement = class extends SettingsRadioGroupElementBase {
	static get is() {
		return "settings-radio-group";
	}
	static get template() {
		return getTemplate$22();
	}
	static get properties() {
		return {
			groupAriaLabel: String,
			/**
			* If true, do not automatically set the preference value. This allows the
			* container to confirm the change first then call either sendPrefChange
			* or resetToPrefValue accordingly.
			*/
			noSetPref: {
				type: Boolean,
				value: false
			},
			selected: String,
			selectableElements: {
				type: String,
				value: ["cr-radio-button", "controlled-radio-button"].join(", ")
			},
			nestedSelectable: {
				type: Boolean,
				value: false
			}
		};
	}
	static get observers() {
		return ["resetToPrefValue(pref.*)"];
	}
	ready() {
		super.ready();
		this.setAttribute("role", "none");
	}
	focus() {
		this.shadowRoot.querySelector("cr-radio-group").focus();
	}
	/** Reset the selected value to match the current pref value. */
	resetToPrefValue() {
		this.selected = prefToString(this.pref);
	}
	/** Update the pref to the current selected value. */
	sendPrefChange() {
		if (!this.pref) return;
		this.set("pref.value", stringToPrefValue(this.selected || "", this.pref));
	}
	onSelectedChanged_() {
		const previous = this.selected;
		this.selected = this.shadowRoot.querySelector("cr-radio-group").selected;
		if (previous === this.selected) return;
		if (!this.noSetPref) this.sendPrefChange();
		this.dispatchEvent(new CustomEvent("change", {
			bubbles: true,
			composed: true
		}));
	}
};
customElements.define(SettingsRadioGroupElement.is, SettingsRadioGroupElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_actionable_row_style.css.js
var styleMod$5 = document.createElement("dom-module");
styleMod$5.appendChild(Ke`
  <template>
    <style>
:host{align-items:center;align-self:stretch;display:flex;margin:0;outline:none}:host(:not([effectively-disabled_])){cursor:pointer}:host(:not([no-hover],[effectively-disabled_]):hover){background-color:var(--cr-hover-background-color)}:host(:not([no-hover],[effectively-disabled_]):active){background-color:var(--cr-active-background-color)}:host(:not([no-hover],[effectively-disabled_])) cr-icon-button{--cr-icon-button-hover-background-color:transparent;--cr-icon-button-active-background-color:transparent}
    </style>
  </template>
`.content);
styleMod$5.register("cr-actionable-row-style");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/action_link.css.js
var styleMod$4 = document.createElement("dom-module");
styleMod$4.appendChild(Ke`
  <template>
    <style>
[is='action-link']{cursor:pointer;display:inline-block;text-decoration:underline}[is='action-link'],[is='action-link']:active,[is='action-link']:hover,[is='action-link']:visited{color:var(--cr-link-color)}[is='action-link'][disabled]{color:var(--cr-fallback-color-disabled-foreground);cursor:default;pointer-events:none}[is='action-link'].no-outline{outline:none}
    </style>
  </template>
`.content);
styleMod$4.register("action-link");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_toggle/cr_toggle.css.js
var instance$17 = null;
function getCss$1() {
	return instance$17 || (instance$17 = [...[], i$4`:host{--cr-toggle-checked-bar-color:var(--color-toggle-button-track-on,var(--cr-fallback-color-primary));--cr-toggle-checked-button-color:var(--color-toggle-button-thumb-on,var(--cr-fallback-color-on-primary));--cr-toggle-checked-ripple-color:var(--cr-active-neutral-on-subtle-background-color);--cr-toggle-ripple-diameter:20px;--cr-toggle-unchecked-bar-color:var(--color-toggle-button-track-off,var(--cr-fallback-color-surface-variant));--cr-toggle-unchecked-button-color:var(--color-toggle-button-thumb-off,var(--cr-fallback-color-outline));--cr-toggle-unchecked-ripple-color:var(--cr-active-neutral-on-subtle-background-color);--cr-toggle-bar-border-color:var(--cr-toggle-unchecked-button-color);--cr-toggle-bar-border:1px solid var(--cr-toggle-bar-border-color);--cr-toggle-bar-width:26px;--cr-toggle-knob-diameter:8px;-webkit-tap-highlight-color:transparent;cursor:pointer;display:block;height:fit-content;isolation:isolate;min-width:initial;outline:none;position:relative;width:fit-content}@media (forced-colors:active){:host #knob{background-color:CanvasText !important}}:host(:active){--cr-toggle-knob-diameter:10px}:host([checked]){--cr-toggle-bar-border-color:var(--cr-toggle-checked-bar-color);--cr-toggle-knob-diameter:12px}:host([checked]:active){--cr-toggle-knob-diameter:14px}:host([disabled]){--cr-toggle-checked-bar-color:var(--color-toggle-button-track-on-disabled,var(--cr-fallback-color-disabled-background));--cr-toggle-checked-button-color:var(--color-toggle-button-thumb-on-disabled,var(--cr-fallback-color-surface));--cr-toggle-unchecked-bar-color:transparent;--cr-toggle-unchecked-button-color:var(--color-toggle-button-thumb-off-disabled,var(--cr-fallback-color-disabled-foreground));--cr-toggle-bar-border-color:var(--cr-toggle-unchecked-button-color);cursor:initial;opacity:1;pointer-events:none}:host([checked][disabled]){--cr-toggle-bar-border:none}#bar{background-color:var(--cr-toggle-unchecked-bar-color);border:var(--cr-toggle-bar-border);border-radius:50px;box-sizing:border-box;display:block;height:16px;left:3px;opacity:1;position:initial;top:2px;transition:background-color linear 80ms;width:var(--cr-toggle-bar-width);z-index:0}:host([checked]) #bar{background-color:var(--cr-toggle-checked-bar-color);opacity:1}:host(:focus-visible) #bar{outline:2px solid var(--cr-toggle-checked-bar-color);outline-offset:2px}#knob{--cr-toggle-knob-center-edge-distance_:8px;--cr-toggle-knob-direction_:1;--cr-toggle-knob-travel-distance_:calc(0.5 * var(--cr-toggle-bar-width) - var(--cr-toggle-knob-center-edge-distance_));--cr-toggle-knob-position-center_:calc(0.5 * var(--cr-toggle-bar-width) + -50%);--cr-toggle-knob-position-start_:calc(var(--cr-toggle-knob-position-center_) - var(--cr-toggle-knob-direction_) * var(--cr-toggle-knob-travel-distance_));--cr-toggle-knob-position-end_:calc(var(--cr-toggle-knob-position-center_) + var(--cr-toggle-knob-direction_) * var(--cr-toggle-knob-travel-distance_));background-color:var(--cr-toggle-unchecked-button-color);border-radius:50%;box-shadow:none;display:block;height:var(--cr-toggle-knob-diameter);position:absolute;top:50%;transform:translate(var(--cr-toggle-knob-position-start_),-50%);transition:transform linear 80ms,background-color linear 80ms,width linear 80ms,height linear 80ms;width:var(--cr-toggle-knob-diameter);z-index:1}:host([checked]) #knob{background-color:var(--cr-toggle-checked-button-color);transform:translate(var(--cr-toggle-knob-position-end_),-50%)}:host-context([dir=rtl]) #knob{left:0;--cr-toggle-knob-direction_:-1}:host([checked]:active) #knob,:host([checked]:hover) #knob{--cr-toggle-checked-button-color:var(--color-toggle-button-thumb-on-hover,var(--cr-fallback-color-primary-container))}:host(:hover) #knob::before{background-color:var(--cr-hover-on-subtle-background-color);border-radius:50%;content:'';height:var(--cr-toggle-ripple-diameter);left:50%;position:absolute;top:50%;transform:translate(-50%,-50%);width:var(--cr-toggle-ripple-diameter)}#ink{--paper-ripple-opacity:1;color:var(--cr-toggle-unchecked-ripple-color);height:var(--cr-toggle-ripple-diameter);left:50%;outline:var(--cr-toggle-ripple-ring,none);pointer-events:none;position:absolute;top:50%;transform:translate(-50%,-50%);transition:color linear 80ms;width:var(--cr-toggle-ripple-diameter)}:host([checked]) #ink{color:var(--cr-toggle-checked-ripple-color)}:host-context([dir=rtl]) #ink{left:auto;right:50%;transform:translate(50%,-50%)}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_toggle/cr_toggle.html.js
function getHtml$1() {
	return x`
<span id="bar"></span>
<span id="knob"></span>`;
}
var CrToggleElementBase = CrRippleMixin(CrLitElement);
var CrToggleElement = class extends CrToggleElementBase {
	static get is() {
		return "cr-toggle";
	}
	static get styles() {
		return getCss$1();
	}
	render() {
		return getHtml$1.bind(this)();
	}
	static get properties() {
		return {
			checked: {
				type: Boolean,
				reflect: true,
				notify: true
			},
			disabled: {
				type: Boolean,
				reflect: true
			}
		};
	}
	#checked_accessor_storage = false;
	get checked() {
		return this.#checked_accessor_storage;
	}
	set checked(value) {
		this.#checked_accessor_storage = value;
	}
	#disabled_accessor_storage = false;
	get disabled() {
		return this.#disabled_accessor_storage;
	}
	set disabled(value) {
		this.#disabled_accessor_storage = value;
	}
	boundPointerMove_ = null;
	/**
	* Whether the state of the toggle has already taken into account by
	* |pointeremove| handlers. Used in the 'click' handler.
	*/
	handledInPointerMove_ = false;
	pointerDownX_ = 0;
	firstUpdated() {
		if (!this.hasAttribute("role")) this.setAttribute("role", "button");
		if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
		this.setAttribute("aria-pressed", this.checked ? "true" : "false");
		this.setAttribute("aria-disabled", this.disabled ? "true" : "false");
		this.addEventListener("click", this.onClick_.bind(this));
		this.addEventListener("keydown", this.onKeyDown_.bind(this));
		this.addEventListener("keyup", this.onKeyUp_.bind(this));
		this.addEventListener("pointerdown", this.onPointerDown_.bind(this));
		this.addEventListener("pointerup", this.onPointerUp_.bind(this));
	}
	connectedCallback() {
		super.connectedCallback();
		const direction = this.matches(":host-context([dir=rtl]) cr-toggle") ? -1 : 1;
		this.boundPointerMove_ = (e) => {
			e.preventDefault();
			const diff = e.clientX - this.pointerDownX_;
			if (Math.abs(diff) < 5) return;
			this.handledInPointerMove_ = true;
			if (diff * direction < 0 && this.checked || diff * direction > 0 && !this.checked) this.toggleState_(false);
		};
	}
	updated(changedProperties) {
		super.updated(changedProperties);
		if (changedProperties.has("checked")) this.setAttribute("aria-pressed", this.checked ? "true" : "false");
		if (changedProperties.has("disabled")) {
			this.setAttribute("tabindex", this.disabled ? "-1" : "0");
			this.setAttribute("aria-disabled", this.disabled ? "true" : "false");
		}
	}
	hideRipple_() {
		this.getRipple().clear();
	}
	onPointerUp_() {
		assert$1(this.boundPointerMove_);
		this.removeEventListener("pointermove", this.boundPointerMove_);
		this.hideRipple_();
	}
	onPointerDown_(e) {
		if (e.button !== 0) return;
		this.setPointerCapture(e.pointerId);
		this.pointerDownX_ = e.clientX;
		this.handledInPointerMove_ = false;
		assert$1(this.boundPointerMove_);
		this.addEventListener("pointermove", this.boundPointerMove_);
	}
	onClick_(e) {
		e.stopPropagation();
		e.preventDefault();
		if (this.handledInPointerMove_) return;
		this.toggleState_(false);
	}
	async toggleState_(fromKeyboard) {
		if (this.disabled) return;
		if (!fromKeyboard) this.hideRipple_();
		this.checked = !this.checked;
		await this.updateComplete;
		this.fire("change", this.checked);
	}
	onKeyDown_(e) {
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		e.stopPropagation();
		if (e.repeat) return;
		if (e.key === "Enter") this.toggleState_(true);
	}
	onKeyUp_(e) {
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		e.stopPropagation();
		if (e.key === " ") this.toggleState_(true);
	}
	createRipple() {
		this.rippleContainer = this.$.knob;
		const ripple = super.createRipple();
		ripple.setAttribute("recenters", "");
		ripple.classList.add("circle");
		return ripple;
	}
};
customElements.define(CrToggleElement.is, CrToggleElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/controls/cr_policy_pref_mixin.js
var CrPolicyPrefMixin = dedupingMixin((superClass) => {
	class CrPolicyPrefMixin extends superClass {
		static get properties() {
			return {
				/**
				* Showing that an extension is controlling a pref is sometimes done
				* with a different UI (e.g. extension-controlled-indicator). In
				* those cases, avoid showing an (extra) indicator here.
				*/
				noExtensionIndicator: Boolean,
				pref: Object
			};
		}
		/**
		* Is the |pref| controlled by something that prevents user control of
		* the preference.
		* @return True if |this.pref| is controlled by an enforced policy.
		*/
		isPrefEnforced() {
			return !!this.pref && this.pref.enforcement === chrome.settingsPrivate.Enforcement.ENFORCED;
		}
		/**
		* @return True if |this.pref| has a recommended or enforced policy.
		*/
		hasPrefPolicyIndicator() {
			if (!this.pref) return false;
			if (this.noExtensionIndicator && this.pref.controlledBy === chrome.settingsPrivate.ControlledBy.EXTENSION) return false;
			return this.isPrefEnforced() || this.pref.enforcement === chrome.settingsPrivate.Enforcement.RECOMMENDED;
		}
	}
	return CrPolicyPrefMixin;
});
var SettingsBooleanControlMixin = dedupingMixin((superClass) => {
	const superClassBase = CrPolicyPrefMixin(PrefControlMixin(superClass));
	class SettingsBooleanControlMixin extends superClassBase {
		static get properties() {
			return {
				/** Whether the control should represent the inverted value. */
				inverted: {
					type: Boolean,
					value: false
				},
				/** Whether the control is checked. */
				checked: {
					type: Boolean,
					value: false,
					notify: true,
					reflectToAttribute: true
				},
				/** Disabled property for the element. */
				disabled: {
					type: Boolean,
					value: false,
					notify: true,
					reflectToAttribute: true
				},
				/**
				* If true, do not automatically set the preference value. This
				* allows the container to confirm the change first then call either
				* sendPrefChange or resetToPrefValue accordingly.
				*/
				noSetPref: {
					type: Boolean,
					value: false
				},
				/** The main label. */
				label: {
					type: String,
					value: ""
				},
				/** Additional (optional) sub-label. */
				subLabel: {
					type: String,
					value: ""
				},
				/**
				* For numeric prefs only. The integer values equivalent to the
				* initial unchecked state. During initialization, the control is
				* unchecked if and only if the pref value is equal to one of the
				* values in the array. When sendPrefChange() is called the *first*
				* value in this array will be sent to the backend.
				*/
				numericUncheckedValues: {
					type: Array,
					value: () => [0]
				},
				/**
				* For numeric prefs only, the integer value equivalent to the
				* checked state. This is the value sent to prefs if the user
				* checked the control.
				*/
				numericCheckedValue: {
					type: Number,
					value: 1
				}
			};
		}
		static get observers() {
			return ["prefValueChanged_(pref.value)"];
		}
		notifyChangedByUserInteraction() {
			this.dispatchEvent(new CustomEvent("settings-boolean-control-change", {
				bubbles: true,
				composed: true
			}));
			if (!this.pref || this.noSetPref) return;
			this.sendPrefChange();
		}
		/** Reset the checked state to match the current pref value. */
		resetToPrefValue() {
			if (this.pref === void 0) {
				this.checked = false;
				return;
			}
			this.checked = this.getNewValue_(this.pref.value);
		}
		/** Update the pref to the current |checked| value. */
		sendPrefChange() {
			if (this.pref.type === chrome.settingsPrivate.PrefType.NUMBER) {
				assert(!this.inverted);
				assert(this.numericUncheckedValues.length > 0);
				this.set("pref.value", this.checked ? this.numericCheckedValue : this.numericUncheckedValues[0]);
				return;
			}
			this.set("pref.value", this.inverted ? !this.checked : this.checked);
		}
		prefValueChanged_(prefValue) {
			this.checked = this.getNewValue_(prefValue);
		}
		/**
		* @return The value as a boolean, inverted if |inverted| is true.
		*/
		getNewValue_(value) {
			if (this.pref.type === chrome.settingsPrivate.PrefType.NUMBER) {
				assert(!this.inverted);
				return !this.numericUncheckedValues.includes(value);
			}
			return this.inverted ? !value : !!value;
		}
		controlDisabled() {
			return this.disabled || this.isPrefEnforced() || !!(this.pref && this.pref.userControlDisabled);
		}
	}
	return SettingsBooleanControlMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_toggle_button.html.js
function getTemplate$21() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style cr-actionable-row-style action-link">:host{--cr-icon-button-margin-end:20px;padding:0 var(--cr-section-padding)}:host([elide-label]),:host([elide-label]) #outerRow,:host([elide-label]) #outerRow>div.flex{min-width:0}:host([elide-label]) .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}div.flex{flex:1}#outerRow{align-items:center;display:flex;min-height:var(--cr-section-two-line-min-height);width:100%}#outerRow[noSubLabel]{min-height:var(--cr-section-min-height)}#icon{margin-inline-end:var(--cr-icon-button-margin-end)}#labelWrapper{padding:var(--cr-section-vertical-padding) 0}#labelWrapper,::slotted([slot='more-actions']){margin-inline-end:20px !important}cr-policy-pref-indicator{margin-inline-end:var(--cr-controlled-by-spacing)}a{color:var(--cr-link-color)}</style>
<div id="outerRow" noSubLabel$="[[!subLabel]]">
  <template is="dom-if" if="[[icon]]">
    <span id="icon" aria-hidden="true">
      <cr-icon slot="icon" icon="[[icon]]">
      </cr-icon>
    </span>
  </template>
  <div class="flex" id="labelWrapper" hidden$="[[!label]]">
    <div class="label" aria-hidden="[[!ariaShowLabel]]">[[label]]</div>
    <div class="cr-secondary-text label" id="sub-label">
      <template is="dom-if" if="[[subLabelIcon]]">
        <span id="sub-label-icon" aria-hidden="true">
          <cr-icon slot="icon" icon="[[subLabelIcon]]">
          </cr-icon>
        </span>
      </template>
      <span id="sub-label-text" aria-hidden="[[!ariaShowSublabel]]">
        [[subLabel]]
      </span>
      <template is="dom-if" if="[[learnMoreUrl]]">
        <a id="learn-more" href="[[learnMoreUrl]]" target="_blank"
            aria-labelledby$="[[getLearnMoreAriaLabelledBy_(learnMoreAriaLabel)]]"
            aria-description="$i18n{opensInNewTab}"
            on-click="onLearnMoreClick_">
          $i18n{learnMore}
        </a>
        <span id="learn-more-aria-label" aria-hidden="true" hidden>
          [[learnMoreAriaLabel]]
        </span>
      </template>
      <template is="dom-if" if="[[subLabelWithLink]]">
        <div id="sub-label-text-with-link"
            inner-h-t-m-l="[[getSubLabelWithLinkContent_(subLabelWithLink)]]"
            on-click="onSubLabelTextWithLinkClick_">
        </div>
      </template>
    </div>
  </div>
  <slot name="more-actions"></slot>
  <template is="dom-if" if="[[hasPrefPolicyIndicator(pref.*)]]">
    <cr-policy-pref-indicator pref="[[pref]]" icon-aria-label="[[label]]">
    </cr-policy-pref-indicator>
  </template>
  <cr-toggle id="control" checked="{{checked}}"
      on-change="onChange_"
      aria-label$="[[getAriaLabel_(label, ariaLabel)]]"
      aria-describedby="sub-label-text"
      disabled="[[controlDisabled(disabled, pref)]]">
  </cr-toggle>
  <slot name="more-actions-after"></slot>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_toggle_button.js
var SettingsToggleButtonElementBase = SettingsBooleanControlMixin(tn);
var SettingsToggleButtonElement = class extends SettingsToggleButtonElementBase {
	static get is() {
		return "settings-toggle-button";
	}
	static get template() {
		return getTemplate$21();
	}
	static get properties() {
		return {
			ariaLabel: {
				type: String,
				reflectToAttribute: false,
				observer: "onAriaLabelSet_",
				value: ""
			},
			ariaShowLabel: {
				type: Boolean,
				reflectToAttribute: true,
				value: false
			},
			ariaShowSublabel: {
				type: Boolean,
				reflectToAttribute: true,
				value: false
			},
			elideLabel: {
				type: Boolean,
				reflectToAttribute: true
			},
			learnMoreUrl: {
				type: String,
				reflectToAttribute: true
			},
			subLabelWithLink: {
				type: String,
				reflectToAttribute: true
			},
			learnMoreAriaLabel: {
				type: String,
				value: ""
			},
			icon: String,
			subLabelIcon: String,
			/**
			* If true, the host element does not get a click event handler and the
			* client is responsible for determining their own click logic. Thus when
			* true, clicking on the setting row does not toggle the setting pref.
			* Note, this boolean is only used on ready() callback, and any changes
			* after that have no effect.
			*/
			noToggleOnHostClick: {
				type: Boolean,
				value: false
			}
		};
	}
	static get observers() {
		return ["onDisableOrPrefChange_(disabled, pref.*)"];
	}
	ready() {
		super.ready();
		if (!this.noToggleOnHostClick) this.addEventListener("click", this.onHostClick_);
	}
	fire_(eventName, detail) {
		this.dispatchEvent(new CustomEvent(eventName, {
			detail,
			bubbles: true,
			composed: true
		}));
	}
	focus() {
		this.$.control.focus();
	}
	/**
	* Removes the aria-label attribute if it's added by $i18n{...}.
	*/
	onAriaLabelSet_() {
		if (this.hasAttribute("aria-label")) {
			const ariaLabel = this.ariaLabel;
			this.removeAttribute("aria-label");
			this.ariaLabel = ariaLabel;
		}
	}
	getAriaLabel_() {
		return this.ariaLabel || this.label;
	}
	getLearnMoreAriaLabelledBy_() {
		return this.learnMoreAriaLabel ? "learn-more-aria-label" : "sub-label-text learn-more";
	}
	getBubbleAnchor() {
		const anchor = this.shadowRoot.querySelector("#control");
		assert(anchor);
		return anchor;
	}
	onDisableOrPrefChange_() {
		this.toggleAttribute("effectively-disabled_", this.controlDisabled());
	}
	/**
	* Handles non cr-toggle button clicks (cr-toggle handles its own click events
	* which don't bubble).
	*/
	onHostClick_(e) {
		assert(!this.noToggleOnHostClick);
		e.stopPropagation();
		if (this.controlDisabled()) return;
		this.updateCheckedAndNotify_(!this.checked);
	}
	onLearnMoreClick_(e) {
		e.stopPropagation();
		this.fire_("learn-more-clicked");
	}
	/**
	* Set up the contents of sub label with link.
	*/
	getSubLabelWithLinkContent_(contents) {
		return sanitizeInnerHtml(contents, { attrs: [
			"id",
			"is",
			"aria-description",
			"aria-hidden",
			"aria-label",
			"aria-labelledby",
			"tabindex"
		] });
	}
	onSubLabelTextWithLinkClick_(e) {
		const target = e.target;
		if (target.tagName === "A") {
			this.fire_("sub-label-link-clicked", target.id);
			e.preventDefault();
			e.stopPropagation();
		}
	}
	onChange_(e) {
		e.stopPropagation();
		this.updateCheckedAndNotify_(e.detail);
	}
	updateCheckedAndNotify_(checked) {
		this.checked = checked;
		this.notifyChangedByUserInteraction();
		this.fire_("change", this.checked);
	}
};
customElements.define(SettingsToggleButtonElement.is, SettingsToggleButtonElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/md_select.css.js
var styleMod$3 = document.createElement("dom-module");
styleMod$3.appendChild(Ke`
  <template>
    <style>
.md-select{--md-arrow-width:7px;--md-select-bg-color:transparent;--md-select-option-bg-color:white;--md-select-side-padding:10px;--md-select-text-color:inherit;-webkit-appearance:none;background:url(//resources/images/arrow_down.svg) calc(100% - var(--md-select-side-padding)) center no-repeat;background-color:var(--md-select-bg-color);background-size:var(--md-arrow-width);border:solid 1px var(--color-combobox-container-outline,var(--cr-fallback-color-neutral-outline));border-radius:8px;box-sizing:border-box;color:var(--md-select-text-color);cursor:pointer;font-family:inherit;font-size:12px;height:36px;max-width:100%;outline:none;padding-block-end:0;padding-block-start:0;padding-inline-end:calc(var(--md-select-side-padding) + var(--md-arrow-width) + 3px);padding-inline-start:var(--md-select-side-padding);width:var(--md-select-width,200px)}@media (prefers-color-scheme:dark){.md-select{--md-select-option-bg-color:var(--google-grey-900-white-4-percent);background-image:url(//resources/images/dark/arrow_down.svg)}}.md-select:hover{background-color:var(--color-comboxbox-ink-drop-hovered,var(--cr-hover-on-subtle-background-color))}.md-select :-webkit-any(option,optgroup){background-color:var(--md-select-option-bg-color)}.md-select[disabled]{background-color:var(--color-combobox-background-disabled,var(--cr-fallback-color-disabled-background));border-color:transparent;color:var(--color-textfield-foreground-disabled,var(--cr-fallback-color-disabled-foreground));opacity:1;pointer-events:none}.md-select:focus{outline:solid 2px var(--cr-focus-outline-color);outline-offset:-1px}:host-context([dir=rtl]) .md-select{background-position-x:var(--md-select-side-padding)}
    </style>
  </template>
`.content);
styleMod$3.register("md-select");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_dropdown_menu.html.js
function getTemplate$20() {
	return Ke`<!--_html_template_start_--><style include="md-select">:host{align-items:center;display:inline-flex}cr-policy-pref-indicator{height:var(--iron-icon-width,24px);margin:0 var(--cr-controlled-by-spacing);order:var(--settings-dropdown-menu-policy-order,0);width:var(--iron-icon-width,24px)}option:disabled{display:none}</style>
<template is="dom-if" if="[[pref.controlledBy]]" restamp>
  <cr-policy-pref-indicator pref="[[pref]]"></cr-policy-pref-indicator>
</template>
<select class="md-select" id="dropdownMenu" on-change="onChange_"
    aria-label$="[[label]]" part="select"
    disabled="[[shouldDisableMenu_(disabled, menuOptions.*, pref.*)]]">
  <template is="dom-repeat" items="[[menuOptions]]">
    <option value="[[item.value]]" hidden="[[item.hidden]]">
      [[item.name]]
    </option>
  </template>
  <option value="[[notFoundValue]]"
      disabled="[[!showNotFoundValue_(menuOptions, pref.value)]]">
    $i18n{custom}
  </option>
</select>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_dropdown_menu.js
var SettingsDropdownMenuElementBase = CrPolicyPrefMixin(PrefControlMixin(tn));
var SettingsDropdownMenuElement = class extends SettingsDropdownMenuElementBase {
	static get is() {
		return "settings-dropdown-menu";
	}
	static get template() {
		return getTemplate$20();
	}
	static get properties() {
		return {
			/**
			* List of options for the drop-down menu.
			*/
			menuOptions: Array,
			/** Whether the dropdown menu should be disabled. */
			disabled: {
				type: Boolean,
				reflectToAttribute: true,
				value: false
			},
			/**
			If this is a dictionary pref, this is the key for the item
			we are interested in.
			*/
			prefKey: {
				type: String,
				value: null
			},
			/**
			* If true, do not automatically set the preference value. This allows the
			* container to confirm the change first then call either sendPrefChange
			* or resetToPrefValue accordingly.
			*/
			noSetPref: {
				type: Boolean,
				value: false
			},
			/**
			* The value of the "custom" item.
			*/
			notFoundValue: {
				type: String,
				value: "SETTINGS_DROPDOWN_NOT_FOUND_ITEM",
				readOnly: true
			},
			/** Label for a11y purposes */
			label: String
		};
	}
	static get observers() {
		return ["updateSelected_(menuOptions, pref.value.*, prefKey)"];
	}
	focus() {
		this.$.dropdownMenu.focus();
	}
	/** Update the pref to the current selected value. */
	sendPrefChange() {
		assert$1(this.pref);
		const selected = this.$.dropdownMenu.value;
		if (this.prefKey) this.set(`pref.value.${this.prefKey}`, selected);
		else {
			const prefValue = stringToPrefValue(selected, this.pref);
			if (prefValue !== void 0) this.set("pref.value", prefValue);
		}
	}
	/**
	* Allow access to the selected value without having to go through the shadow
	* dom.
	*/
	getSelectedValue() {
		return this.$.dropdownMenu.value;
	}
	/**
	* Pass the selection change to the pref value.
	*/
	onChange_() {
		if (this.$.dropdownMenu.value === this.notFoundValue) return;
		if (!this.noSetPref) this.sendPrefChange();
		this.dispatchEvent(new CustomEvent("settings-control-change", {
			bubbles: true,
			composed: true
		}));
	}
	/**
	* Updates the selected item when the pref or menuOptions change.
	*/
	updateSelected_() {
		if (this.menuOptions === void 0 || this.pref === void 0 || this.prefKey === void 0) return;
		if (!this.menuOptions.length) return;
		const prefValue = this.prefStringValue_();
		const option = this.menuOptions.find(function(menuItem) {
			return menuItem.value.toString() === prefValue;
		});
		h.run(() => {
			this.$.dropdownMenu.value = option === void 0 ? this.notFoundValue : prefValue;
		});
	}
	/**
	* Gets the current value of the preference as a string.
	*/
	prefStringValue_() {
		if (this.prefKey) return this.pref.value[this.prefKey];
		else {
			assert$1(this.pref);
			return prefToString(this.pref);
		}
	}
	showNotFoundValue_(menuOptions, prefValue) {
		if (menuOptions === void 0 || prefValue === void 0) return false;
		if (menuOptions === null || menuOptions.length === 0) return false;
		return !menuOptions.find((menuItem) => {
			return menuItem.value.toString() === this.prefStringValue_();
		});
	}
	shouldDisableMenu_() {
		return this.disabled || this.isPrefEnforced() || this.menuOptions === void 0 || this.menuOptions.length === 0;
	}
};
customElements.define(SettingsDropdownMenuElement.is, SettingsDropdownMenuElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/parse_html_subset.js
/**
* Make a string safe for Polymer bindings that are inner-h-t-m-l or other
* innerHTML use.
* @param rawString The unsanitized string
* @param opts Optional additional allowed tags and attributes.
*/
function sanitizeInnerHtmlInternal(rawString, opts) {
	opts = opts || {};
	return parseHtmlSubset(`<b>${rawString}</b>`, opts.tags, opts.attrs).firstElementChild.innerHTML;
}
var sanitizedPolicy = null;
/**
* Same as |sanitizeInnerHtmlInternal|, but it passes through sanitizedPolicy
* to create a TrustedHTML.
*/
function sanitizeInnerHtml$1(rawString, opts) {
	assert$1(window.trustedTypes);
	if (sanitizedPolicy === null) sanitizedPolicy = window.trustedTypes.createPolicy("sanitize-inner-html", {
		createHTML: sanitizeInnerHtmlInternal,
		createScript: () => assertNotReached$1(),
		createScriptURL: () => assertNotReached$1()
	});
	return sanitizedPolicy.createHTML(rawString, opts);
}
var allowAttribute = (_node, _value) => true;
/** Allow-list of attributes in parseHtmlSubset. */
var allowedAttributes = /* @__PURE__ */ new Map([["href", (node, value) => {
	return node.tagName === "A" && (value.startsWith("astro://") || value.startsWith("https://") || value === "#");
}], ["target", (node, value) => {
	return node.tagName === "A" && value === "_blank";
}]]);
/** Allow-list of optional attributes in parseHtmlSubset. */
var allowedOptionalAttributes = /* @__PURE__ */ new Map([
	["class", allowAttribute],
	["id", allowAttribute],
	["is", (_node, value) => value === "action-link" || value === ""],
	["role", (_node, value) => value === "link"],
	["src", (node, value) => {
		return node.tagName === "IMG" && value.startsWith("astro://");
	}],
	["tabindex", allowAttribute],
	["aria-description", allowAttribute],
	["aria-hidden", allowAttribute],
	["aria-label", allowAttribute],
	["aria-labelledby", allowAttribute]
]);
/** Allow-list of tag names in parseHtmlSubset. */
var allowedTags = /* @__PURE__ */ new Set([
	"A",
	"B",
	"I",
	"BR",
	"DIV",
	"EM",
	"KBD",
	"P",
	"PRE",
	"SPAN",
	"STRONG"
]);
/** Allow-list of optional tag names in parseHtmlSubset. */
var allowedOptionalTags = /* @__PURE__ */ new Set([
	"IMG",
	"LI",
	"UL"
]);
/**
* This policy maps a given string to a `TrustedHTML` object
* without performing any validation. Callsites must ensure
* that the resulting object will only be used in inert
* documents. Initialized lazily.
*/
var unsanitizedPolicy;
/**
* @param optTags an Array to merge.
* @return Set of allowed tags.
*/
function mergeTags(optTags) {
	const clone = new Set(allowedTags);
	optTags.forEach((str) => {
		const tag = str.toUpperCase();
		if (allowedOptionalTags.has(tag)) clone.add(tag);
	});
	return clone;
}
/**
* @param optAttrs an Array to merge.
* @return Map of allowed attributes.
*/
function mergeAttrs(optAttrs) {
	const clone = new Map(allowedAttributes);
	optAttrs.forEach((key) => {
		if (allowedOptionalAttributes.has(key)) clone.set(key, allowedOptionalAttributes.get(key));
	});
	return clone;
}
function walk(n, f) {
	f(n);
	for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i], f);
}
function assertElement(tags, node) {
	if (!tags.has(node.tagName)) throw Error(node.tagName + " is not supported");
}
function assertAttribute(attrs, attrNode, node) {
	const n = attrNode.nodeName;
	const v = attrNode.nodeValue || "";
	if (!attrs.has(n) || !attrs.get(n)(node, v)) throw Error(node.tagName + "[" + n + "=\"" + v + "\"] is not supported");
}
/**
* Parses a very small subset of HTML. This ensures that insecure HTML /
* javascript cannot be injected into WebUI.
* @param s The string to parse.
* @param extraTags Optional extra allowed tags.
* @param extraAttrs
*     Optional extra allowed attributes (all tags are run through these).
* @throws an Error in case of non supported markup.
* @return A document fragment containing the DOM tree.
*/
function parseHtmlSubset(s, extraTags, extraAttrs) {
	const tags = extraTags ? mergeTags(extraTags) : allowedTags;
	const attrs = extraAttrs ? mergeAttrs(extraAttrs) : allowedAttributes;
	const doc = document.implementation.createHTMLDocument("");
	const r = doc.createRange();
	r.selectNode(doc.body);
	if (window.trustedTypes) {
		if (!unsanitizedPolicy) unsanitizedPolicy = window.trustedTypes.createPolicy("parse-html-subset", {
			createHTML: (untrustedHTML) => untrustedHTML,
			createScript: () => assertNotReached$1(),
			createScriptURL: () => assertNotReached$1()
		});
		s = unsanitizedPolicy.createHTML(s);
	}
	const df = r.createContextualFragment(s);
	walk(df, function(node) {
		switch (node.nodeType) {
			case Node.ELEMENT_NODE:
				assertElement(tags, node);
				const nodeAttrs = node.attributes;
				for (let i = 0; i < nodeAttrs.length; ++i) assertAttribute(attrs, nodeAttrs[i], node);
				break;
			case Node.COMMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE:
			case Node.TEXT_NODE: break;
			default: throw Error("Node type " + node.nodeType + " is not supported");
		}
	});
	return df;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/i18n_mixin.js
/**
* @fileoverview
* 'I18nMixin' is a Mixin offering loading of internationalization
* strings. Typically it is used as [[i18n('someString')]] computed bindings or
* for this.i18n('foo'). It is not needed for HTML $i18n{otherString}, which is
* handled by a C++ templatizer.
*/
var I18nMixin$1 = d$2((superClass) => {
	class I18nMixin extends superClass {
		/**
		* Returns a translated string where $1 to $9 are replaced by the given
		* values.
		* @param id The ID of the string to translate.
		* @param varArgs Values to replace the placeholders $1 to $9 in the
		*     string.
		* @return A translated, substituted string.
		*/
		i18nRaw_(id, ...varArgs) {
			return varArgs.length === 0 ? loadTimeData$1.getString(id) : loadTimeData$1.getStringF(id, ...varArgs);
		}
		/**
		* Returns a translated string where $1 to $9 are replaced by the given
		* values. Also sanitizes the output to filter out dangerous HTML/JS.
		* Use with Polymer bindings that are *not* inner-h-t-m-l.
		* NOTE: This is not related to $i18n{foo} in HTML, see file overview.
		* @param id The ID of the string to translate.
		* @param varArgs Values to replace the placeholders $1 to $9 in the
		*     string.
		* @return A translated, sanitized, substituted string.
		*/
		i18n(id, ...varArgs) {
			return parseHtmlSubset(`<b>${this.i18nRaw_(id, ...varArgs)}</b>`).firstChild.textContent;
		}
		/**
		* Similar to 'i18n', returns a translated, sanitized, substituted
		* string. It receives the string ID and a dictionary containing the
		* substitutions as well as optional additional allowed tags and
		* attributes. Use with Polymer bindings that are inner-h-t-m-l, for
		* example.
		* @param id The ID of the string to translate.
		*/
		i18nAdvanced(id, opts) {
			opts = opts || {};
			return sanitizeInnerHtml$1(this.i18nRaw_(id, ...opts.substitutions || []), opts);
		}
		/**
		* Similar to 'i18n', with an unused |locale| parameter used to trigger
		* updates when the locale changes.
		* @param locale The UI language used.
		* @param id The ID of the string to translate.
		* @param varArgs Values to replace the placeholders $1 to $9 in the
		*     string.
		* @return A translated, sanitized, substituted string.
		*/
		i18nDynamic(_locale, id, ...varArgs) {
			return this.i18n(id, ...varArgs);
		}
		/**
		* Similar to 'i18nDynamic', but varArgs valus are interpreted as keys
		* in loadTimeData. This allows generation of strings that take other
		* localized strings as parameters.
		* @param locale The UI language used.
		* @param id The ID of the string to translate.
		* @param varArgs Values to replace the placeholders $1 to $9
		*     in the string. Values are interpreted as strings IDs if found in
		* the list of localized strings.
		* @return A translated, sanitized, substituted string.
		*/
		i18nRecursive(locale, id, ...varArgs) {
			let args = varArgs;
			if (args.length > 0) args = args.map((str) => {
				return this.i18nExists(str) ? loadTimeData$1.getString(str) : str;
			});
			return this.i18nDynamic(locale, id, ...args);
		}
		/**
		* Returns true if a translation exists for |id|.
		*/
		i18nExists(id) {
			return loadTimeData$1.valueExists(id);
		}
	}
	return I18nMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/password_manager_proxy.js
/**
* Represents different referrers when navigating to the Password Check page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*/
var PasswordCheckReferrer;
(function(PasswordCheckReferrer) {
	PasswordCheckReferrer[PasswordCheckReferrer["SAFETY_CHECK"] = 0] = "SAFETY_CHECK";
	PasswordCheckReferrer[PasswordCheckReferrer["PASSWORD_SETTINGS"] = 1] = "PASSWORD_SETTINGS";
	PasswordCheckReferrer[PasswordCheckReferrer["PHISH_GUARD_DIALOG"] = 2] = "PHISH_GUARD_DIALOG";
	PasswordCheckReferrer[PasswordCheckReferrer["PASSWORD_BREACH_DIALOG"] = 3] = "PASSWORD_BREACH_DIALOG";
	PasswordCheckReferrer[PasswordCheckReferrer["MORE_TO_FIX_BUBBLE"] = 4] = "MORE_TO_FIX_BUBBLE";
	PasswordCheckReferrer[PasswordCheckReferrer["SAFETY_CHECK_MAGIC_STACK"] = 6] = "SAFETY_CHECK_MAGIC_STACK";
	PasswordCheckReferrer[PasswordCheckReferrer["SAFETY_CHECK_NOTIFICATION"] = 7] = "SAFETY_CHECK_NOTIFICATION";
	PasswordCheckReferrer[PasswordCheckReferrer["COUNT"] = 8] = "COUNT";
})(PasswordCheckReferrer || (PasswordCheckReferrer = {}));
var PasswordManagerPage;
(function(PasswordManagerPage) {
	PasswordManagerPage[PasswordManagerPage["PASSWORDS"] = 0] = "PASSWORDS";
	PasswordManagerPage[PasswordManagerPage["CHECKUP"] = 1] = "CHECKUP";
})(PasswordManagerPage || (PasswordManagerPage = {}));
/**
* Implementation that accesses the private API.
*/
var PasswordManagerImpl = class PasswordManagerImpl {
	recordPasswordsPageAccessInSettings() {
		chrome.passwordsPrivate.recordPasswordsPageAccessInSettings();
	}
	/** override */
	recordPasswordCheckReferrer(referrer) {
		chrome.metricsPrivate.recordEnumerationValue("PasswordManager.BulkCheck.PasswordCheckReferrer", referrer, PasswordCheckReferrer.COUNT);
	}
	showPasswordManager(page) {
		chrome.send("showPasswordManager", [page]);
	}
	static getInstance() {
		return instance$16 || (instance$16 = new PasswordManagerImpl());
	}
	static setInstance(obj) {
		instance$16 = obj;
	}
};
var instance$16 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/site_favicon.html.js
function getTemplate$19() {
	return Ke`<!--_html_template_start_-->    <style>#favicon{background-repeat:no-repeat;background-size:contain;border-radius:var(--site-favicon-border-radius,inherit);display:block;height:var(--site-favicon-height,16px);width:var(--site-favicon-width,16px)}
    </style>
    <div
        id="favicon"
        style="background-image:
            [[getBackgroundImage_(faviconUrl, url, iconPath)]]">
    </div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/site_favicon.js
/**
* @fileoverview 'site-favicon' is the section to display the favicon given the
* site URL.
*/
var SiteFaviconElement = class extends PolymerElement {
	static get is() {
		return "site-favicon";
	}
	static get template() {
		return getTemplate$19();
	}
	static get properties() {
		return {
			faviconUrl: String,
			url: String,
			iconPath: String
		};
	}
	getBackgroundImage_() {
		let backgroundImage = getFavicon("");
		if (this.iconPath) backgroundImage = "url(" + this.iconPath + ")";
		else if (this.faviconUrl) {
			const url = this.ensureUrlHasScheme_(this.faviconUrl);
			backgroundImage = getFavicon(url);
		} else if (this.url) {
			let url = this.removePatternWildcard_(this.url);
			url = this.ensureUrlHasScheme_(url);
			backgroundImage = getFaviconForPageURL(url || "", false);
		}
		return backgroundImage;
	}
	/**
	* Removes the wildcard prefix from a pattern string.
	* @param pattern The pattern to remove the wildcard from.
	* @return The resulting pattern.
	*/
	removePatternWildcard_(pattern) {
		if (!pattern || pattern.length === 0) return pattern;
		if (pattern.startsWith("http://[*.]")) return pattern.replace("http://[*.]", "http://");
		else if (pattern.startsWith("https://[*.]")) return pattern.replace("https://[*.]", "https://");
		else if (pattern.startsWith("[*.]")) return pattern.substring(4, pattern.length);
		return pattern;
	}
	/**
	* Ensures the URL has a scheme (assumes http if omitted).
	* @param url The URL with or without a scheme.
	* @return The URL with a scheme, or an empty string.
	*/
	ensureUrlHasScheme_(url) {
		if (!url || url.length === 0) return url;
		return url.includes("://") ? url : "http://" + url;
	}
};
customElements.define(SiteFaviconElement.is, SiteFaviconElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/scrollable_mixin.js
var ScrollableMixin = d$2((superClass) => {
	class ScrollableMixin extends superClass {
		resizeObserver_;
		constructor(...args) {
			super(...args);
			this.resizeObserver_ = new ResizeObserver((entries) => {
				requestAnimationFrame(() => {
					for (const entry of entries) this.onScrollableContainerResize_(entry.target);
				});
			});
		}
		ready() {
			super.ready();
			Rn(this, () => {
				this.requestUpdateScroll();
				const scrollableElements = this.shadowRoot.querySelectorAll("[scrollable]");
				for (const scrollableElement of scrollableElements) scrollableElement.addEventListener("scroll", this.updateScrollEvent_.bind(this));
			});
		}
		disconnectedCallback() {
			super.disconnectedCallback();
			this.resizeObserver_.disconnect();
		}
		/**
		* Called any time the contents of a scrollable container may have
		* changed. This ensures that the <iron-list> contents of dynamically
		* sized containers are resized correctly.
		*/
		updateScrollableContents() {
			this.requestUpdateScroll();
			const ironLists = this.shadowRoot.querySelectorAll("[scrollable] iron-list");
			for (const ironList of ironLists) {
				const scrollContainer = ironList.parentElement;
				const scrollHeight = scrollContainer.scrollHeight;
				if (scrollHeight <= 1 && ironList.items.length > 0 && window.getComputedStyle(scrollContainer).display !== "none") this.resizeObserver_.observe(scrollContainer);
				if (scrollHeight !== 0) ironList.notifyResize();
			}
		}
		/**
		* Setup the initial scrolling related classes for each scrollable
		* container. Called from ready() and updateScrollableContents(). May
		* also be called directly when the contents change (e.g. when not using
		* iron-list).
		*/
		requestUpdateScroll() {
			requestAnimationFrame(() => {
				const scrollableElements = this.shadowRoot.querySelectorAll("[scrollable]");
				for (const scrollableElement of scrollableElements) this.updateScroll_(scrollableElement);
			});
		}
		saveScroll(list) {
			list.savedScrollTops = list.savedScrollTops || [];
			list.savedScrollTops.push(list.scrollTarget.scrollTop);
		}
		restoreScroll(list) {
			h.run(() => {
				const scrollTop = list.savedScrollTops.shift();
				if (scrollTop !== 0) list.scroll(0, scrollTop);
			});
		}
		/**
		* Event wrapper for updateScroll_.
		*/
		updateScrollEvent_(event) {
			const scrollable = event.target;
			this.updateScroll_(scrollable);
		}
		/**
		* This gets called once initially and any time a scrollable container
		* scrolls.
		*/
		updateScroll_(scrollable) {
			scrollable.classList.toggle("can-scroll", scrollable.clientHeight < scrollable.scrollHeight);
			scrollable.classList.toggle("is-scrolled", scrollable.scrollTop > 0);
			scrollable.classList.toggle("scrolled-to-bottom", scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight);
		}
		/**
		* This gets called upon a resize event on the scrollable element
		*/
		onScrollableContainerResize_(scrollable) {
			const nodeList = scrollable.querySelectorAll("iron-list");
			if (nodeList.length === 0 || scrollable.scrollHeight > 1) this.resizeObserver_.unobserve(scrollable);
			if (scrollable.scrollHeight !== 0) for (const node of nodeList) node.notifyResize();
		}
	}
	return ScrollableMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/util.js
/**
* @return The currently focused element (including elements that are
*     behind a shadow root), or null if nothing is focused.
*/
function getDeepActiveElement() {
	let a = document.activeElement;
	while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
	return a;
}
/**
* Check the directionality of the page.
* @return True if Chrome is running an RTL UI.
*/
function isRTL() {
	return document.documentElement.dir === "rtl";
}
/**
* Calls |callback| and stops listening the first time any event in |eventNames|
* is triggered on |target|.
* @param eventNames Array or space-delimited string of event names to listen to
*     (e.g. 'click mousedown').
* @param callback Called at most once. The optional return value is passed on
*     by the listener.
*/
function listenOnce(target, eventNames, callback) {
	const eventNamesArray = Array.isArray(eventNames) ? eventNames : eventNames.split(/ +/);
	const removeAllAndCallCallback = function(event) {
		eventNamesArray.forEach(function(eventName) {
			target.removeEventListener(eventName, removeAllAndCallCallback, false);
		});
		return callback(event);
	};
	eventNamesArray.forEach(function(eventName) {
		target.addEventListener(eventName, removeAllAndCallCallback, false);
	});
}
/**
* @return Whether a modifier key was down when processing |e|.
*/
function hasKeyModifiers(e) {
	return !!(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/focus_row.js
var ACTIVE_CLASS = "focus-row-active";
/**
* A class to manage focus between given horizontally arranged elements.
*
* Pressing left cycles backward and pressing right cycles forward in item
* order. Pressing Home goes to the beginning of the list and End goes to the
* end of the list.
*
* If an item in this row is focused, it'll stay active (accessible via tab).
* If no items in this row are focused, the row can stay active until focus
* changes to a node inside |this.boundary_|. If |boundary| isn't specified,
* any focus change deactivates the row.
*/
var FocusRow = class FocusRow {
	root;
	delegate;
	eventTracker = new EventTracker();
	boundary_;
	/**
	* @param root The root of this focus row. Focus classes are
	*     applied to |root| and all added elements must live within |root|.
	* @param boundary Focus events are ignored outside of this element.
	* @param delegate An optional event delegate.
	*/
	constructor(root, boundary, delegate) {
		this.root = root;
		this.boundary_ = boundary || document.documentElement;
		this.delegate = delegate;
	}
	/**
	* Whether it's possible that |element| can be focused.
	*/
	static isFocusable(element) {
		if (!element || element.disabled) return false;
		let current = element;
		while (true) {
			assertInstanceof(current, Element);
			const style = window.getComputedStyle(current);
			if (style.visibility === "hidden" || style.display === "none") return false;
			const parent = current.parentNode;
			if (!parent) return false;
			if (parent === current.ownerDocument || parent instanceof DocumentFragment) return true;
			current = parent;
		}
	}
	/**
	* A focus override is a function that returns an element that should gain
	* focus. The element may not be directly selectable for example the element
	* that can gain focus is in a shadow DOM. Allowing an override via a
	* function leaves the details of how the element is retrieved to the
	* component.
	*/
	static getFocusableElement(element) {
		const withFocusable = element;
		if (withFocusable.getFocusableElement) return withFocusable.getFocusableElement();
		return element;
	}
	/**
	* Register a new type of focusable element (or add to an existing one).
	*
	* Example: an (X) button might be 'delete' or 'close'.
	*
	* When FocusRow is used within a FocusGrid, these types are used to
	* determine equivalent controls when Up/Down are pressed to change rows.
	*
	* Another example: mutually exclusive controls that hide each other on
	* activation (i.e. Play/Pause) could use the same type (i.e. 'play-pause')
	* to indicate they're equivalent.
	*
	* @param type The type of element to track focus of.
	* @param selectorOrElement The selector of the element
	*    from this row's root, or the element itself.
	* @return Whether a new item was added.
	*/
	addItem(type, selectorOrElement) {
		assert$1(type);
		let element;
		if (typeof selectorOrElement === "string") element = this.root.querySelector(selectorOrElement);
		else element = selectorOrElement;
		if (!element) return false;
		element.setAttribute("focus-type", type);
		element.tabIndex = this.isActive() ? 0 : -1;
		this.eventTracker.add(element, "blur", this.onBlur_.bind(this));
		this.eventTracker.add(element, "focus", this.onFocus_.bind(this));
		this.eventTracker.add(element, "keydown", this.onKeydown_.bind(this));
		this.eventTracker.add(element, "mousedown", this.onMousedown_.bind(this));
		return true;
	}
	/** Dereferences nodes and removes event handlers. */
	destroy() {
		this.eventTracker.removeAll();
	}
	/**
	* @param sampleElement An element for to find an equivalent
	*     for.
	* @return An equivalent element to focus for
	*     |sampleElement|.
	*/
	getCustomEquivalent(_sampleElement) {
		const focusable = this.getFirstFocusable();
		assert$1(focusable);
		return focusable;
	}
	/**
	* @return All registered elements (regardless of focusability).
	*/
	getElements() {
		return Array.from(this.root.querySelectorAll("[focus-type]")).map(FocusRow.getFocusableElement);
	}
	/**
	* Find the element that best matches |sampleElement|.
	* @param sampleElement An element from a row of the same
	*     type which previously held focus.
	* @return The element that best matches sampleElement.
	*/
	getEquivalentElement(sampleElement) {
		if (this.getFocusableElements().indexOf(sampleElement) >= 0) return sampleElement;
		const sampleFocusType = this.getTypeForElement(sampleElement);
		if (sampleFocusType) {
			const sameType = this.getFirstFocusable(sampleFocusType);
			if (sameType) return sameType;
		}
		return this.getCustomEquivalent(sampleElement);
	}
	/**
	* @param type An optional type to search for.
	* @return The first focusable element with |type|.
	*/
	getFirstFocusable(type) {
		return this.getFocusableElements().find((el) => !type || el.getAttribute("focus-type") === type) || null;
	}
	/** @return Registered, focusable elements. */
	getFocusableElements() {
		return this.getElements().filter(FocusRow.isFocusable);
	}
	/**
	* @param element An element to determine a focus type for.
	* @return The focus type for |element| or '' if none.
	*/
	getTypeForElement(element) {
		return element.getAttribute("focus-type") || "";
	}
	/** @return Whether this row is currently active. */
	isActive() {
		return this.root.classList.contains(ACTIVE_CLASS);
	}
	/**
	* Enables/disables the tabIndex of the focusable elements in the FocusRow.
	* tabIndex can be set properly.
	* @param active True if tab is allowed for this row.
	*/
	makeActive(active) {
		if (active === this.isActive()) return;
		this.getElements().forEach(function(element) {
			element.tabIndex = active ? 0 : -1;
		});
		this.root.classList.toggle(ACTIVE_CLASS, active);
	}
	onBlur_(e) {
		if (!this.boundary_.contains(e.relatedTarget)) return;
		const currentTarget = e.currentTarget;
		if (this.getFocusableElements().indexOf(currentTarget) >= 0) this.makeActive(false);
	}
	onFocus_(e) {
		if (this.delegate) this.delegate.onFocus(this, e);
	}
	onMousedown_(e) {
		if (e.button) return;
		const target = e.currentTarget;
		if (!target.disabled) target.tabIndex = 0;
	}
	onKeydown_(e) {
		const elements = this.getFocusableElements();
		const currentElement = FocusRow.getFocusableElement(e.currentTarget);
		const elementIndex = elements.indexOf(currentElement);
		assert$1(elementIndex >= 0);
		if (this.delegate && this.delegate.onKeydown(this, e)) return;
		const isShiftTab = !e.altKey && !e.ctrlKey && !e.metaKey && e.shiftKey && e.key === "Tab";
		if (hasKeyModifiers(e) && !isShiftTab) return;
		let index = -1;
		let shouldStopPropagation = true;
		if (isShiftTab) {
			index = elementIndex - 1;
			if (index < 0) return;
		} else if (e.key === "ArrowLeft") index = elementIndex + (isRTL() ? 1 : -1);
		else if (e.key === "ArrowRight") index = elementIndex + (isRTL() ? -1 : 1);
		else if (e.key === "Home") index = 0;
		else if (e.key === "End") index = elements.length - 1;
		else shouldStopPropagation = false;
		const elementToFocus = elements[index];
		if (elementToFocus) {
			this.getEquivalentElement(elementToFocus).focus();
			e.preventDefault();
		}
		if (shouldStopPropagation) e.stopPropagation();
	}
};
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/platform.js
/** Whether we are using a Mac or not. */
var isMac = /Mac/.test(navigator.platform);
/** Whether this is on the Windows platform or not. */
var isWindows = /Win/.test(navigator.platform);
/Linux/.test(navigator.userAgent);
/Android/.test(navigator.userAgent);
/CriOS/.test(navigator.userAgent);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_action_menu/cr_action_menu.css.js
var instance$15 = null;
function getCss() {
	return instance$15 || (instance$15 = [...[], i$4`:host{--cr-hairline:1px solid var(--color-menu-separator,var(--cr-fallback-color-divider));--cr-action-menu-disabled-item-color:var(--color-menu-item-foreground-disabled,var(--cr-fallback-color-disabled-foreground));--cr-action-menu-disabled-item-opacity:1;--cr-menu-background-color:var(--color-menu-background,var(--cr-fallback-color-surface));--cr-menu-background-focus-color:var(--cr-hover-background-color);--cr-menu-shadow:var(--cr-elevation-2);--cr-primary-text-color:var(--color-menu-item-foreground,var(--cr-fallback-color-on-surface))}:host dialog{background-color:var(--cr-menu-background-color);border:none;border-radius:var(--cr-menu-border-radius,4px);box-shadow:var(--cr-menu-shadow);margin:0;min-width:128px;outline:none;overflow:var(--cr-action-menu-overflow,auto);padding:0;position:absolute}@media (forced-colors:active){:host dialog{border:var(--cr-border-hcm)}}:host dialog::backdrop{background-color:transparent}:host ::slotted(.dropdown-item){-webkit-tap-highlight-color:transparent;background:none;border:none;border-radius:0;box-sizing:border-box;color:var(--cr-primary-text-color);font:inherit;min-height:32px;padding:8px 24px;text-align:start;user-select:none;width:100%}:host ::slotted(.dropdown-item:not([hidden])){align-items:center;display:flex}:host ::slotted(.dropdown-item[disabled]){color:var(--cr-action-menu-disabled-item-color,var(--cr-primary-text-color));opacity:var(--cr-action-menu-disabled-item-opacity,0.65)}:host ::slotted(.dropdown-item:not([disabled])){cursor:pointer}:host ::slotted(.dropdown-item:focus){background-color:var(--cr-menu-background-focus-color);outline:none}:host ::slotted(.dropdown-item:focus-visible){outline:solid 2px var(--cr-focus-outline-color);outline-offset:-2px}@media (forced-colors:active){:host ::slotted(.dropdown-item:focus){outline:var(--cr-focus-outline-hcm)}}.item-wrapper{outline:none;padding:var(--cr-action-menu-padding,8px 0)}`]);
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_action_menu/cr_action_menu.html.js
function getHtml() {
	return x`
<dialog id="dialog" part="dialog" @close="${this.onNativeDialogClose_}"
    role="application"
    aria-roledescription="${this.roleDescription || E}">
  <div id="wrapper" class="item-wrapper" role="menu" tabindex="-1"
      aria-label="${this.accessibilityLabel || E}">
    <slot id="contentNode" @slotchange="${this.onSlotchange_}"></slot>
  </div>
</dialog>`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/cr_action_menu/cr_action_menu.js
var AnchorAlignment$1;
(function(AnchorAlignment) {
	AnchorAlignment[AnchorAlignment["BEFORE_START"] = -2] = "BEFORE_START";
	AnchorAlignment[AnchorAlignment["AFTER_START"] = -1] = "AFTER_START";
	AnchorAlignment[AnchorAlignment["CENTER"] = 0] = "CENTER";
	AnchorAlignment[AnchorAlignment["BEFORE_END"] = 1] = "BEFORE_END";
	AnchorAlignment[AnchorAlignment["AFTER_END"] = 2] = "AFTER_END";
})(AnchorAlignment$1 || (AnchorAlignment$1 = {}));
var DROPDOWN_ITEM_CLASS = "dropdown-item";
var SELECTABLE_DROPDOWN_ITEM_QUERY = `.${DROPDOWN_ITEM_CLASS}:not([hidden]):not([disabled])`;
var AFTER_END_OFFSET = 10;
/**
* Returns the point to start along the X or Y axis given a start and end
* point to anchor to, the length of the target and the direction to anchor
* in. If honoring the anchor would force the menu outside of min/max, this
* will ignore the anchor position and try to keep the menu within min/max.
*/
function getStartPointWithAnchor(start, end, menuLength, anchorAlignment, min, max) {
	let startPoint = 0;
	switch (anchorAlignment) {
		case AnchorAlignment$1.BEFORE_START:
			startPoint = start - menuLength;
			break;
		case AnchorAlignment$1.AFTER_START:
			startPoint = start;
			break;
		case AnchorAlignment$1.CENTER:
			startPoint = (start + end - menuLength) / 2;
			break;
		case AnchorAlignment$1.BEFORE_END:
			startPoint = end - menuLength;
			break;
		case AnchorAlignment$1.AFTER_END:
			startPoint = end;
			break;
		default: assertNotReachedCase$1(anchorAlignment);
	}
	if (startPoint + menuLength > max) startPoint = end - menuLength;
	if (startPoint < min) startPoint = start;
	startPoint = Math.max(min, Math.min(startPoint, max - menuLength));
	return startPoint;
}
function getDefaultShowConfig() {
	return {
		top: 0,
		left: 0,
		height: 0,
		width: 0,
		anchorAlignmentX: AnchorAlignment$1.AFTER_START,
		anchorAlignmentY: AnchorAlignment$1.AFTER_START,
		minX: 0,
		minY: 0,
		maxX: 0,
		maxY: 0
	};
}
var CrActionMenuElement = class extends CrLitElement {
	static get is() {
		return "cr-action-menu";
	}
	static get styles() {
		return getCss();
	}
	render() {
		return getHtml.bind(this)();
	}
	static get properties() {
		return {
			accessibilityLabel: { type: String },
			autoReposition: { type: Boolean },
			open: {
				type: Boolean,
				notify: true
			},
			nonModal: {
				type: Boolean,
				reflect: true
			},
			roleDescription: { type: String }
		};
	}
	#accessibilityLabel_accessor_storage;
	get accessibilityLabel() {
		return this.#accessibilityLabel_accessor_storage;
	}
	set accessibilityLabel(value) {
		this.#accessibilityLabel_accessor_storage = value;
	}
	#autoReposition_accessor_storage = false;
	get autoReposition() {
		return this.#autoReposition_accessor_storage;
	}
	set autoReposition(value) {
		this.#autoReposition_accessor_storage = value;
	}
	#open_accessor_storage = false;
	get open() {
		return this.#open_accessor_storage;
	}
	set open(value) {
		this.#open_accessor_storage = value;
	}
	#roleDescription_accessor_storage;
	get roleDescription() {
		return this.#roleDescription_accessor_storage;
	}
	set roleDescription(value) {
		this.#roleDescription_accessor_storage = value;
	}
	#nonModal_accessor_storage = false;
	get nonModal() {
		return this.#nonModal_accessor_storage;
	}
	set nonModal(value) {
		this.#nonModal_accessor_storage = value;
	}
	boundClose_ = null;
	resizeObserver_ = null;
	hasMousemoveListener_ = false;
	anchorElement_ = null;
	lastConfig_ = null;
	firstUpdated() {
		this.addEventListener("keydown", this.onKeyDown_.bind(this));
		this.addEventListener("mouseover", this.onMouseover_);
		this.addEventListener("click", this.onClick_);
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		this.removeListeners_();
	}
	/**
	* Exposing internal <dialog> elements for tests.
	*/
	getDialog() {
		return this.$.dialog;
	}
	removeListeners_() {
		window.removeEventListener("resize", this.boundClose_);
		window.removeEventListener("popstate", this.boundClose_);
		if (this.resizeObserver_) {
			this.resizeObserver_.disconnect();
			this.resizeObserver_ = null;
		}
	}
	onNativeDialogClose_(e) {
		if (e.target !== this.$.dialog) return;
		this.fire("close");
	}
	onClick_(e) {
		if (e.target === this) {
			this.close();
			e.stopPropagation();
		}
	}
	onKeyDown_(e) {
		e.stopPropagation();
		if (e.key === "Tab" || e.key === "Escape") {
			this.close();
			if (e.key === "Tab") this.fire("tabkeyclose", { shiftKey: e.shiftKey });
			e.preventDefault();
			return;
		}
		if (e.key !== "Enter" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
		const options = Array.from(this.querySelectorAll(SELECTABLE_DROPDOWN_ITEM_QUERY));
		if (options.length === 0) return;
		const focused = getDeepActiveElement();
		const index = options.findIndex((option) => FocusRow.getFocusableElement(option) === focused);
		if (e.key === "Enter") {
			if (index !== -1) return;
			if (isWindows || isMac) {
				this.close();
				e.preventDefault();
				return;
			}
		}
		e.preventDefault();
		this.updateFocus_(options, index, e.key !== "ArrowUp");
		if (!this.hasMousemoveListener_) {
			this.hasMousemoveListener_ = true;
			this.addEventListener("mousemove", (e) => {
				this.onMouseover_(e);
				this.hasMousemoveListener_ = false;
			}, { once: true });
		}
	}
	onMouseover_(e) {
		(e.composedPath().find((el) => el.matches && el.matches(SELECTABLE_DROPDOWN_ITEM_QUERY)) || this.$.wrapper).focus();
	}
	updateFocus_(options, focusedIndex, next) {
		const numOptions = options.length;
		assert$1(numOptions > 0);
		let index;
		if (focusedIndex === -1) index = next ? 0 : numOptions - 1;
		else {
			const delta = next ? 1 : -1;
			index = (numOptions + focusedIndex + delta) % numOptions;
		}
		options[index].focus();
	}
	close() {
		if (!this.open) return;
		this.removeListeners_();
		this.$.dialog.close();
		this.open = false;
		if (this.anchorElement_) {
			assert$1(this.anchorElement_);
			focusWithoutInk(this.anchorElement_);
			this.anchorElement_ = null;
		}
		if (this.lastConfig_) this.lastConfig_ = null;
	}
	/**
	* Shows the menu anchored to the given element.
	*/
	showAt(anchorElement, config) {
		this.anchorElement_ = anchorElement;
		this.anchorElement_.scrollIntoViewIfNeeded();
		const rect = this.anchorElement_.getBoundingClientRect();
		let height = rect.height;
		if (config && !config.noOffset && config.anchorAlignmentY === AnchorAlignment$1.AFTER_END) height -= AFTER_END_OFFSET;
		this.showAtPosition(Object.assign({
			top: rect.top,
			left: rect.left,
			height,
			width: rect.width,
			anchorAlignmentX: AnchorAlignment$1.BEFORE_END
		}, config));
		this.$.wrapper.focus();
	}
	/**
	* Shows the menu anchored to the given box. The anchor alignment is
	* specified as an X and Y alignment which represents a point in the anchor
	* where the menu will align to, which can have the menu either before or
	* after the given point in each axis. Center alignment places the center of
	* the menu in line with the center of the anchor. Coordinates are relative to
	* the top-left of the viewport.
	*
	*            y-start
	*         _____________
	*         |           |
	*         |           |
	*         |   CENTER  |
	* x-start |     x     | x-end
	*         |           |
	*         |anchor box |
	*         |___________|
	*
	*             y-end
	*
	* For example, aligning the menu to the inside of the top-right edge of
	* the anchor, extending towards the bottom-left would use a alignment of
	* (BEFORE_END, AFTER_START), whereas centering the menu below the bottom
	* edge of the anchor would use (CENTER, AFTER_END).
	*/
	showAtPosition(config) {
		const doc = document.scrollingElement;
		const scrollLeft = doc.scrollLeft;
		const scrollTop = doc.scrollTop;
		this.resetStyle_();
		this.nonModal ? this.$.dialog.show() : this.$.dialog.showModal();
		this.open = true;
		config.top += scrollTop;
		config.left += scrollLeft;
		this.positionDialog_(Object.assign({
			minX: scrollLeft,
			minY: scrollTop,
			maxX: scrollLeft + doc.clientWidth,
			maxY: scrollTop + doc.clientHeight
		}, config));
		doc.scrollTop = scrollTop;
		doc.scrollLeft = scrollLeft;
		this.addListeners_();
		if (FocusOutlineManager.forDocument(document).visible) {
			const firstSelectableItem = this.querySelector(SELECTABLE_DROPDOWN_ITEM_QUERY);
			if (firstSelectableItem) requestAnimationFrame(() => {
				firstSelectableItem.focus();
			});
		}
	}
	resetStyle_() {
		this.$.dialog.style.left = "";
		this.$.dialog.style.right = "";
		this.$.dialog.style.top = "0";
	}
	/**
	* Position the dialog using the coordinates in config. Coordinates are
	* relative to the top-left of the viewport when scrolled to (0, 0).
	*/
	positionDialog_(config) {
		this.lastConfig_ = config;
		const c = Object.assign(getDefaultShowConfig(), config);
		const top = c.top;
		const left = c.left;
		const bottom = top + c.height;
		const right = left + c.width;
		const rtl = getComputedStyle(this).direction === "rtl";
		if (rtl) c.anchorAlignmentX *= -1;
		const offsetWidth = this.$.dialog.offsetWidth;
		const menuLeft = getStartPointWithAnchor(left, right, offsetWidth, c.anchorAlignmentX, c.minX, c.maxX);
		if (rtl) {
			const menuRight = document.scrollingElement.clientWidth - menuLeft - offsetWidth;
			this.$.dialog.style.right = menuRight + "px";
		} else this.$.dialog.style.left = menuLeft + "px";
		const menuTop = getStartPointWithAnchor(top, bottom, this.$.dialog.offsetHeight, c.anchorAlignmentY, c.minY, c.maxY);
		this.$.dialog.style.top = menuTop + "px";
	}
	onSlotchange_() {
		for (const node of this.$.contentNode.assignedElements({ flatten: true })) if (node.classList.contains(DROPDOWN_ITEM_CLASS) && !node.getAttribute("role")) node.setAttribute("role", "menuitem");
	}
	addListeners_() {
		this.boundClose_ = this.boundClose_ || (() => {
			if (this.$.dialog.open) this.close();
		});
		window.addEventListener("resize", this.boundClose_);
		window.addEventListener("popstate", this.boundClose_);
		if (this.autoReposition) {
			this.resizeObserver_ = new ResizeObserver(() => {
				if (this.lastConfig_) {
					this.positionDialog_(this.lastConfig_);
					this.fire("cr-action-menu-repositioned");
				}
			});
			this.resizeObserver_.observe(this.$.dialog);
		}
	}
};
customElements.define(CrActionMenuElement.is, CrActionMenuElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/people_page/profile_info_browser_proxy.js
var ProfileInfoBrowserProxyImpl = class ProfileInfoBrowserProxyImpl {
	getProfileInfo() {
		return sendWithPromise("getProfileInfo");
	}
	getProfileStatsCount() {
		chrome.send("getProfileStatsCount");
	}
	static getInstance() {
		return instance$14 || (instance$14 = new ProfileInfoBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$14 = obj;
	}
};
var instance$14 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/js/cr.js
/** Counter for use with createUid */
var uidCounter = 1;
/** @return A new unique ID. */
function createUid() {
	return uidCounter++;
}
/**
* The mapping used by the sendWithPromise mechanism to tie the Promise
* returned to callers with the corresponding WebUI response. The mapping is
* from ID to the PromiseResolver helper; the ID is generated by
* sendWithPromise and is unique across all invocations of said method.
*/
var chromeSendResolverMap = {};
/**
* The named method the WebUI handler calls directly in response to a
* chrome.send call that expects a response. The handler requires no knowledge
* of the specific name of this method, as the name is passed to the handler
* as the first argument in the arguments list of chrome.send. The handler
* must pass the ID, also sent via the chrome.send arguments list, as the
* first argument of the JS invocation; additionally, the handler may
* supply any number of other arguments that will be included in the response.
* @param id The unique ID identifying the Promise this response is
*     tied to.
* @param isSuccess Whether the request was successful.
* @param response The response as sent from C++.
*/
function webUIResponse(id, isSuccess, response) {
	const resolver = chromeSendResolverMap[id];
	assert$1(resolver);
	delete chromeSendResolverMap[id];
	if (isSuccess) resolver.resolve(response);
	else resolver.reject(response);
}
/**
* A map of maps associating event names with listeners. The 2nd level map
* associates a listener ID with the callback function, such that individual
* listeners can be removed from an event without affecting other listeners of
* the same event.
*/
var webUiListenerMap = {};
/**
* The named method the WebUI handler calls directly when an event occurs.
* The WebUI handler must supply the name of the event as the first argument
* of the JS invocation; additionally, the handler may supply any number of
* other arguments that will be forwarded to the listener callbacks.
* @param event The name of the event that has occurred.
* @param args Additional arguments passed from C++.
*/
function webUIListenerCallback(event, ...args) {
	const eventListenersMap = webUiListenerMap[event];
	if (!eventListenersMap) return;
	for (const listenerId in eventListenersMap) eventListenersMap[listenerId].apply(null, args);
}
/**
* Registers a listener for an event fired from WebUI handlers. Any number of
* listeners may register for a single event.
* @param eventName The event to listen to.
* @param callback The callback run when the event is fired.
* @return An object to be used for removing a listener via
*     removeWebUiListener. Should be treated as read-only.
*/
function addWebUiListener(eventName, callback) {
	webUiListenerMap[eventName] = webUiListenerMap[eventName] || {};
	const uid = createUid();
	webUiListenerMap[eventName][uid] = callback;
	return {
		eventName,
		uid
	};
}
/**
* Removes a listener. Does nothing if the specified listener is not found.
* @param listener The listener to be removed (as returned by addWebUiListener).
* @return Whether the given listener was found and actually removed.
*/
function removeWebUiListener(listener) {
	if (webUiListenerMap[listener.eventName] && webUiListenerMap[listener.eventName][listener.uid]) {
		const map = webUiListenerMap[listener.eventName];
		delete map[listener.uid];
		return true;
	}
	return false;
}
assert$1(!window.cr);
Object.assign(window, { cr: {
	webUIResponse,
	webUIListenerCallback
} });
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/ui/webui/resources/tsc/cr_elements/web_ui_listener_mixin.js
var WebUiListenerMixin$1 = d$2((superClass) => {
	class WebUiListenerMixin extends superClass {
		/**
		* Holds WebUI listeners that need to be removed when this element is
		* destroyed.
		*/
		webUiListeners_ = [];
		/**
		* Adds a WebUI listener and registers it for automatic removal when
		* this element is detached. Note: Do not use this method if you intend
		* to remove this listener manually (use addWebUiListener directly
		* instead).
		*
		* @param eventName The event to listen to.
		* @param callback The callback run when the event is fired.
		*/
		addWebUiListener(eventName, callback) {
			this.webUiListeners_.push(addWebUiListener(eventName, callback));
		}
		disconnectedCallback() {
			super.disconnectedCallback();
			while (this.webUiListeners_.length > 0) removeWebUiListener(this.webUiListeners_.pop());
		}
	}
	return WebUiListenerMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/people_page/sync_browser_proxy.js
/**
* Equivalent to C++ counterpart.
* @see chrome/browser/signin/signin_ui_util.h
* TODO(b/336510160): Look into integrating SYNC_PAUSED value.
*/
var SignedInState;
(function(SignedInState) {
	SignedInState[SignedInState["SIGNED_OUT"] = 0] = "SIGNED_OUT";
	SignedInState[SignedInState["SIGNED_IN"] = 1] = "SIGNED_IN";
	SignedInState[SignedInState["SYNCING"] = 2] = "SYNCING";
	SignedInState[SignedInState["SIGNED_IN_PAUSED"] = 3] = "SIGNED_IN_PAUSED";
	SignedInState[SignedInState["WEB_ONLY_SIGNED_IN"] = 4] = "WEB_ONLY_SIGNED_IN";
})(SignedInState || (SignedInState = {}));
/**
* Must be kept in sync with the return values of getSyncErrorAction in
* chrome/browser/ui/webui/settings/people_handler.cc
*/
var StatusAction;
(function(StatusAction) {
	StatusAction["NO_ACTION"] = "noAction";
	StatusAction["REAUTHENTICATE"] = "reauthenticate";
	StatusAction["UPGRADE_CLIENT"] = "upgradeClient";
	StatusAction["ENTER_PASSPHRASE"] = "enterPassphrase";
	StatusAction["RETRIEVE_TRUSTED_VAULT_KEYS"] = "retrieveTrustedVaultKeys";
	StatusAction["CONFIRM_SYNC_SETTINGS"] = "confirmSyncSettings";
	StatusAction["SHOW_BOOKMARKS_LIMIT_HELP_ARTICLE"] = "showBookmarksLimitHelpArticle";
})(StatusAction || (StatusAction = {}));
/**
* Checks whether the error associated with the given status action is
* configurable, meaning that the user should still be able to interact with the
* sync controls.
*/
function shouldShowSyncTogglesForStatusAction(statusAction) {
	switch (statusAction) {
		case StatusAction.ENTER_PASSPHRASE:
		case StatusAction.RETRIEVE_TRUSTED_VAULT_KEYS:
		case StatusAction.CONFIRM_SYNC_SETTINGS:
		case StatusAction.SHOW_BOOKMARKS_LIMIT_HELP_ARTICLE: return true;
		case StatusAction.NO_ACTION:
		case StatusAction.REAUTHENTICATE:
		case StatusAction.UPGRADE_CLIENT: return false;
		default: assertNotReached();
	}
}
/**
* Names of the individual data type properties to be cached from
* SyncPrefs when the user checks 'Sync All'.
*/
var syncPrefsIndividualDataTypes = [
	"appsSynced",
	"autofillSynced",
	"bookmarksSynced",
	"cookiesSynced",
	"extensionsSynced",
	"readingListSynced",
	"passwordsSynced",
	"paymentsSynced",
	"preferencesSynced",
	"productComparisonSynced",
	"savedTabGroupsSynced",
	"tabsSynced",
	"themesSynced",
	"typedUrlsSynced",
	"wifiConfigurationsSynced"
];
var UserSelectableType;
(function(UserSelectableType) {
	UserSelectableType[UserSelectableType["BOOKMARKS"] = 0] = "BOOKMARKS";
	UserSelectableType[UserSelectableType["PREFERENCES"] = 1] = "PREFERENCES";
	UserSelectableType[UserSelectableType["PASSWORDS"] = 2] = "PASSWORDS";
	UserSelectableType[UserSelectableType["AUTOFILL"] = 3] = "AUTOFILL";
	UserSelectableType[UserSelectableType["THEMES"] = 4] = "THEMES";
	UserSelectableType[UserSelectableType["HISTORY"] = 5] = "HISTORY";
	UserSelectableType[UserSelectableType["EXTENSIONS"] = 6] = "EXTENSIONS";
	UserSelectableType[UserSelectableType["APPS"] = 7] = "APPS";
	UserSelectableType[UserSelectableType["READING_LIST"] = 8] = "READING_LIST";
	UserSelectableType[UserSelectableType["TABS"] = 9] = "TABS";
	UserSelectableType[UserSelectableType["SAVED_TAB_GROUPS"] = 10] = "SAVED_TAB_GROUPS";
	UserSelectableType[UserSelectableType["PAYMENTS"] = 11] = "PAYMENTS";
	UserSelectableType[UserSelectableType["PRODUCT_COMPARISON"] = 12] = "PRODUCT_COMPARISON";
	UserSelectableType[UserSelectableType["COOKIES"] = 13] = "COOKIES";
})(UserSelectableType || (UserSelectableType = {}));
var PageStatus;
(function(PageStatus) {
	PageStatus["SPINNER"] = "spinner";
	PageStatus["CONFIGURE"] = "configure";
	PageStatus["DONE"] = "done";
	PageStatus["PASSPHRASE_FAILED"] = "passphraseFailed";
})(PageStatus || (PageStatus = {}));
var TrustedVaultBannerState;
(function(TrustedVaultBannerState) {
	TrustedVaultBannerState[TrustedVaultBannerState["NOT_SHOWN"] = 0] = "NOT_SHOWN";
	TrustedVaultBannerState[TrustedVaultBannerState["OFFER_OPT_IN"] = 1] = "OFFER_OPT_IN";
	TrustedVaultBannerState[TrustedVaultBannerState["OPTED_IN"] = 2] = "OPTED_IN";
})(TrustedVaultBannerState || (TrustedVaultBannerState = {}));
var ChromeSigninUserChoice;
(function(ChromeSigninUserChoice) {
	ChromeSigninUserChoice[ChromeSigninUserChoice["NO_CHOICE"] = 0] = "NO_CHOICE";
	ChromeSigninUserChoice[ChromeSigninUserChoice["ALWAYS_ASK"] = 1] = "ALWAYS_ASK";
	ChromeSigninUserChoice[ChromeSigninUserChoice["SIGNIN"] = 2] = "SIGNIN";
	ChromeSigninUserChoice[ChromeSigninUserChoice["DO_NOT_SIGNIN"] = 3] = "DO_NOT_SIGNIN";
})(ChromeSigninUserChoice || (ChromeSigninUserChoice = {}));
var ChromeSigninAccessPoint;
(function(ChromeSigninAccessPoint) {
	ChromeSigninAccessPoint[ChromeSigninAccessPoint["SETTINGS"] = 0] = "SETTINGS";
	ChromeSigninAccessPoint[ChromeSigninAccessPoint["SETTINGS_YOUR_SAVED_INFO"] = 1] = "SETTINGS_YOUR_SAVED_INFO";
})(ChromeSigninAccessPoint || (ChromeSigninAccessPoint = {}));
var SyncBrowserProxyImpl = class SyncBrowserProxyImpl {
	startSignIn(accessPoint) {
		chrome.send("SyncSetupStartSignIn", [accessPoint]);
	}
	signOut(deleteProfile) {
		chrome.send("SyncSetupSignout", [deleteProfile]);
	}
	pauseSync() {
		chrome.send("SyncSetupPauseSync");
	}
	didNavigateToAccountSettingsPage() {
		chrome.send("ShowAccountSettingsUI");
	}
	setSyncDatatype(pref, value) {
		return sendWithPromise("SetDatatype", pref, value);
	}
	recordSigninPendingOffered() {
		chrome.send("RecordSigninPendingOffered");
	}
	startKeyRetrieval() {
		chrome.send("SyncStartKeyRetrieval");
	}
	showBookmarkLimitExceededHelp() {
		chrome.send("SyncShowBookmarkLimitExceededHelp");
	}
	showSyncPassphraseDialog() {
		chrome.send("SyncShowSyncPassphraseDialog");
	}
	getSyncStatus() {
		return sendWithPromise("SyncSetupGetSyncStatus");
	}
	getStoredAccounts() {
		return sendWithPromise("SyncSetupGetStoredAccounts");
	}
	getProfileAvatar() {
		return sendWithPromise("SyncSetupGetProfileAvatar");
	}
	didNavigateToSyncPage() {
		chrome.send("SyncSetupShowSetupUI");
	}
	didNavigateAwayFromSyncPage(didAbort) {
		chrome.send("SyncSetupDidClosePage", [didAbort]);
	}
	setSyncDatatypes(syncPrefs) {
		return sendWithPromise("SyncSetupSetDatatypes", JSON.stringify(syncPrefs));
	}
	setEncryptionPassphrase(passphrase) {
		return sendWithPromise("SyncSetupSetEncryptionPassphrase", passphrase);
	}
	setDecryptionPassphrase(passphrase) {
		return sendWithPromise("SyncSetupSetDecryptionPassphrase", passphrase);
	}
	startSyncingWithEmail(email, isDefaultPromoAccount) {
		chrome.send("SyncSetupStartSyncingWithEmail", [email, isDefaultPromoAccount]);
	}
	openActivityControlsUrl() {
		chrome.metricsPrivate.recordUserAction("Signin_AccountSettings_GoogleActivityControlsClicked");
	}
	sendSyncPrefsChanged() {
		chrome.send("SyncPrefsDispatch");
	}
	sendTrustedVaultBannerStateChanged() {
		chrome.send("SyncTrustedVaultBannerStateDispatch");
	}
	setChromeSigninUserChoice(choice, signedInEmail) {
		chrome.send("SetChromeSigninUserChoice", [choice, signedInEmail]);
	}
	getChromeSigninUserChoiceInfo() {
		return sendWithPromise("GetChromeSigninUserChoiceInfo");
	}
	static getInstance() {
		return instance$13 || (instance$13 = new SyncBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$13 = obj;
	}
};
var instance$13 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/people_page/sync_account_control.html.js
function getTemplate$18() {
	return Ke`<!--_html_template_start_-->    <style include="cr-shared-style settings-shared">:host{--shown-avatar-size:40px;--sync-icon-border-size:2px;--sync-icon-size:16px}:host([promo-type_="sync"]){h3{font-size:inherit;margin:0;font-weight:normal}#banner{background:url(astro://settings/images/sync_banner.svg) no-repeat;background-size:100% auto;display:none;padding-top:calc(120 / 680 * 100%);display:block}@media (prefers-color-scheme:dark){#banner{background-image:url(astro://settings/images/sync_banner_dark.svg)}}}:host([promo-type_="signin"]){h3{margin-top:4px;margin-bottom:4px;font-size:1rem;font-weight:500;letter-spacing:.25px}#banner{background:url(astro://settings/images/signin_banner.svg) no-repeat;background-size:100% auto;display:none;padding-top:calc(120 / 680 * 100%);display:block}@media (prefers-color-scheme:dark){#banner{background-image:url(astro://settings/images/signin_banner_dark.svg)}}}.account-icon{border-radius:50%;flex-shrink:0;height:var(--shown-avatar-size);width:var(--shown-avatar-size)}.account-icon.small{height:20px;width:20px}#menu .dropdown-item{padding:12px}#menu .dropdown-item span{margin-inline-start:8px}.flex{display:flex;flex:1;flex-direction:column}#avatar-container{height:var(--shown-avatar-size);position:relative}#sync-icon-container{align-items:center;background:var(--google-green-700);border:var(--sync-icon-border-size) solid white;border-radius:50%;display:flex;height:var(--sync-icon-size);position:absolute;right:-6px;top:calc(var(--shown-avatar-size) - var(--sync-icon-size) - var(--sync-icon-border-size));width:var(--sync-icon-size)}:host-context([dir='rtl']) #sync-icon-container{left:-6px;right:initial}@media (prefers-color-scheme:dark){#sync-icon-container{background:var(--google-green-300);border-color:var(--google-grey-900)}}#sync-icon-container.sync-problem{background:var(--settings-error-color)}#sync-icon-container.sync-paused{background:var(--google-blue-500)}@media (prefers-color-scheme:dark){#sync-icon-container.sync-paused{background:var(--google-blue-300)}}#sync-icon-container.sync-disabled{background:var(--google-grey-400)}@media (prefers-color-scheme:dark){#sync-icon-container.sync-disabled{background:var(--google-grey-500)}}#sync-icon-container cr-icon{fill:white;height:12px;margin:auto;width:12px}#signIn{min-width:100px}

    </style>
    <div id="banner" hidden="[[shouldHideBanner_(syncStatus.signedInState)]]"
        part="banner"></div>
    <div class="cr-row first"
        id="promo-header" hidden="[[shouldHideBanner_(
              syncStatus.signedInState)]]">
      <div class="flex cr-padded-text">
        <h3 id="promo-title" part="title">
          [[getLabel_(promoLabelWithAccount,
              promoLabelWithNoAccount, shownAccount_)]]
        </h3>
        <div class="secondary">[[subLabel_]]</div>
      </div>
      <cr-button class="action-button cr-button-gap" on-click="onSigninClick_"
          id="signIn"
          disabled="[[shouldDisableSyncButton_(showSetupButtons_,
                  syncStatus.firstSetupInProgress,
                  prefs.signin.allowed_on_next_startup.value)]]"
          hidden="[[shouldShowAvatarRow_]]">
        $i18n{peopleSignInNoAccountAwareness}
      </cr-button>
    </div>
    <template is="dom-if" if="[[shouldShowAvatarRow_]]">
      <div class="cr-row first two-line" id="avatar-row">
        <div id="avatar-container">
          <img class="account-icon" alt=""
              src="[[getProfileImageSrc_(
                shownAccount_.avatarImage,
                profileAvatarURL_)]]">
          <div id="sync-icon-container"
              hidden="[[!isSyncing_(syncStatus.signedInState)]]"
              class$="[[getSyncIconStyle_(
                  syncStatus.hasError, syncStatus.statusAction,
                  syncStatus.disabled)]]">
            <cr-icon icon$="[[getSyncIcon_(
                syncStatus.hasError, syncStatus.statusAction,
                syncStatus.disabled)]]"></cr-icon>
          </div>
        </div>
        <div class="cr-row-gap cr-padded-text flex no-min-width" id="user-info">
          <div class="text-elide">
            [[getAvatarRowTitle_(shownAccount_.fullName,
                '$i18nPolymer{syncNotWorking}',
                '$i18nPolymer{syncPasswordsNotWorking}',
                '$i18nPolymer{syncPaused}',
                '$i18nPolymer{syncDisabled}',
                '$i18nPolymer{accountAwareRowTitle}',
                syncStatus.hasError,
                syncStatus.statusAction, syncStatus.disabled)]]
          </div>
          <div class="secondary text-elide"
              hidden="[[shouldHideSubtitleWithAccountInfoText_(syncStatus)]]">
            [[getAccountLabel_(
                '$i18nPolymer{signedInTo}',
                '$i18nPolymer{syncingTo}',
                shownAccount_.email, syncStatus.hasError,
                syncStatus.signedInState, syncStatus.disabled,
                syncStatus.firstSetupInProgress,
                shownAccount_.isPrimaryAccount)]]
          </div>
          <div class="secondary"
              hidden="[[!shouldHideSubtitleWithAccountInfoText_(syncStatus)]]">
            [[getAvatarSubtitleLabel_(
              '$i18nPolymer{accountAwareRowSubtitle}',
              '$i18nPolymer{pendingStateAvatarRowSubtitle}',
              shownAccount_.email,
              this.syncStatus.signedInState)]]
          </div>
        </div>
        <cr-icon-button class="icon-arrow-dropdown cr-button-gap"
            hidden="[[!shouldAllowAccountSwitch_(syncStatus.signedInState,
                syncStatus.domain)]]"
            on-click="onMenuButtonClick_" id="dropdown-arrow"
            aria-label="$i18n{changeAccount}"
            aria-expanded="false">
        </cr-icon-button>
        <div class="separator"
            hidden="[[!shouldAllowAccountSwitch_(syncStatus.signedInState,
                syncStatus.domain)]]">
        </div>
        <cr-button id="signout-button" class="cr-button-gap"
            hidden="[[shouldHideSignoutButton_(syncStatus.signedInState)]]"
            on-click="onSignoutClick_">
          $i18n{signOutOfChrome}
        </cr-button>
        <cr-button id="sync-button" class="action-button cr-button-gap"
            hidden="[[shouldHideSyncButton_(syncStatus.signedInState)]]"
            on-click="onSyncButtonClick_"
            disabled="[[shouldDisableSyncButton_(showSetupButtons_,
                syncStatus.firstSetupInProgress,
                prefs.signin.allowed_on_next_startup.value)]]">
          $i18nPolymer{turnOnSync}
        </cr-button>
        <cr-button id="turn-off"
            class="cr-button-gap"
            hidden="[[!shouldShowTurnOffButton_(syncStatus.signedInState,
                syncStatus.domain, showSetupButtons_)]]"
            on-click="onTurnOffButtonClick_"
            disabled="[[syncStatus.firstSetupInProgress]]">
          [[getTurnOffSyncLabel_(
            '$i18nPolymer{turnOffSync}',
            syncStatus.secondaryButtonActionText)]]
        </cr-button>
        <cr-button id="sync-error-button" class="action-button cr-button-gap"
            hidden="[[!shouldShowErrorActionButton_(syncStatus,
            showSetupButtons_, syncStatus.statusAction)]]"
            on-click="onErrorButtonClick_"
            disabled="[[syncStatus.firstSetupInProgress]]">
          [[syncStatus.statusActionText]]
        </cr-button>
        <cr-button class="action-button cr-button-gap"
            on-click="onSyncButtonClick_" id="account-aware"
            hidden="[[!shouldShowAccountAwareSigninButton_(
                syncStatus.signedInState)]]">
        <img class="account-icon small" alt=""
        src="[[getAccountImageSrc_(shownAccount_.avatarImage)]]"
        slot="prefix-icon">
        [[getAccountAwareSigninButtonLabel_(
          '$i18nPolymer{accountAwareSigninButtonLabel}',
          shownAccount_.givenName)]]
        </cr-button>
        <div id="setup-buttons" hidden="[[!showSetupButtons_]]"
            class="cr-button-gap">
          <cr-button on-click="onSetupCancel_">$i18n{cancel}</cr-button>
          <cr-button class="action-button cr-button-gap"
              on-click="onSetupConfirm_">
            $i18n{confirm}
          </cr-button>
        </div>
        <div id="signin-paused-buttons"
            hidden="[[!shouldShowSigninPausedButtons_]]">
          <cr-button class="cr-button-gap" id="remove-account-button"
              hidden="[[shouldHideRemoveAccountButton_(
                  syncStatus.signedInState)]]"
              on-click="onSignoutClick_">
            $i18n{pendingSecondaryButton}
          </cr-button>
          <cr-button class="action-button cr-button-gap"
              on-click="onSigninClick_">
            $i18n{verifyAccount}
          </cr-button>
        </div>

      </div>
      <template is="dom-if"
          if="[[shouldAllowAccountSwitch_(syncStatus.signedInState,
              syncStatus.domain)]]" restamp>
        <cr-action-menu id="menu" auto-reposition
            role-description="$i18n{menu}" on-close="onDropdownClose_">
          <template is="dom-repeat" items="[[storedAccounts_]]">
            <button class="dropdown-item" on-click="onAccountClick_">
              <img class="account-icon small" alt=""
                  src="[[getAccountImageSrc_(item.avatarImage)]]">
              <span>[[item.email]]</span>
            </button>
          </template>
          <button class="dropdown-item" on-click="onSigninClick_"
                  disabled="[[syncStatus.firstSetupInProgress]]"
                  id="sign-in-item">
            <cr-icon icon="cr:add" class="account-icon small" alt=""></cr-icon>
            <span>$i18n{useAnotherAccount}</span>
          </button>
        </cr-action-menu>
      </template>
    </template>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/people_page/sync_account_control.js
var PromoType;
(function(PromoType) {
	PromoType["SIGNIN"] = "signin";
	PromoType["SYNC"] = "sync";
})(PromoType || (PromoType = {}));
var SettingsSyncAccountControlElementBase = WebUiListenerMixin$1(PrefsMixin(RouteObserverMixin(tn)));
var SettingsSyncAccountControlElement = class extends SettingsSyncAccountControlElementBase {
	static get is() {
		return "settings-sync-account-control";
	}
	static get template() {
		return getTemplate$18();
	}
	static get properties() {
		return {
			/**
			* The current sync status, supplied by parent element.
			*/
			syncStatus: Object,
			promoLabelWithAccount: String,
			promoLabelWithNoAccount: String,
			promoSecondaryLabelWithAccount: String,
			promoSecondaryLabelWithNoAccount: String,
			/**
			* Proxy variable for syncStatus.signedInState to shield observer from
			* being triggered multiple times whenever syncStatus changes.
			*/
			syncing_: {
				type: Boolean,
				computed: "isSyncing_(syncStatus.signedInState)",
				observer: "onSyncChanged_"
			},
			storedAccounts_: Object,
			profileAvatarURL_: {
				type: String,
				value: null,
				observer: "handleUpdateAvatar_"
			},
			shownAccount_: Object,
			embeddedInSubpage: {
				type: Boolean,
				reflectToAttribute: true
			},
			hideButtons: {
				type: Boolean,
				value: false,
				reflectToAttribute: true
			},
			hideBanner: {
				type: Boolean,
				value: false,
				reflectToAttribute: true
			},
			accessPoint: {
				type: Number,
				reflectToAttribute: true
			},
			shouldShowAvatarRow_: {
				type: Boolean,
				value: false,
				computed: "computeShouldShowAvatarRow_(storedAccounts_, syncStatus,storedAccounts_.length, syncStatus.signedInState)",
				observer: "onShouldShowAvatarRowChange_"
			},
			shouldShowSigninPausedButtons_: {
				type: Boolean,
				value: false,
				computed: "computeShouldShowSigninPausedButtons_(syncStatus,syncStatus.signedInState)",
				observer: "maybeRecordSigninPendingOffered_"
			},
			subLabel_: {
				type: String,
				computed: "computeSubLabel_(promoSecondaryLabelWithAccount,promoSecondaryLabelWithNoAccount, shownAccount_)"
			},
			showSetupButtons_: {
				type: Boolean,
				computed: "computeShowSetupButtons_(hideButtons, syncStatus.firstSetupInProgress)"
			},
			promoType_: {
				type: String,
				reflectToAttribute: true
			}
		};
	}
	static get observers() {
		return ["onShownAccountShouldChange_(storedAccounts_, syncStatus)"];
	}
	signinPausedImpressionRecorded_ = false;
	syncBrowserProxy_ = SyncBrowserProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		this.syncBrowserProxy_.getStoredAccounts().then(this.handleStoredAccounts_.bind(this));
		this.syncBrowserProxy_.getProfileAvatar().then(this.handleUpdateAvatar_.bind(this));
		this.addWebUiListener("stored-accounts-updated", this.handleStoredAccounts_.bind(this));
		this.addWebUiListener("profile-avatar-changed", this.handleUpdateAvatar_.bind(this));
		this.promoType_ = loadTimeData$2.getBoolean("replaceSyncPromosWithSignInPromos") ? PromoType.SIGNIN : PromoType.SYNC;
	}
	currentRouteChanged(_newRoute, _oldRoute) {
		this.maybeRecordSigninPendingOffered_();
	}
	/**
	* Records Signin_Impression_FromSettings user action.
	*/
	recordImpressionUserActions_() {
		assert$1(!this.isSyncing_());
		chrome.metricsPrivate.recordUserAction("Signin_Impression_FromSettings");
	}
	onSyncChanged_() {
		if (this.embeddedInSubpage) return;
		if (!this.isSyncing_() && this.shownAccount_ !== void 0) this.recordImpressionUserActions_();
	}
	getLabel_(labelWithAccount, labelWithNoAccount) {
		return this.shownAccount_ ? labelWithAccount : labelWithNoAccount;
	}
	computeSubLabel_() {
		return this.getLabel_(this.promoSecondaryLabelWithAccount, this.promoSecondaryLabelWithNoAccount);
	}
	getSubstituteLabel_(label, name) {
		return loadTimeData$2.substituteString(label, name);
	}
	getAccountLabel_(signedInLabel, syncingLabel, email) {
		if (this.syncStatus.signedInState === SignedInState.SIGNED_IN_PAUSED) return email;
		if (this.syncStatus.firstSetupInProgress) return this.syncStatus.statusText || email;
		if (this.isSyncing_() && !this.syncStatus.hasError && !this.syncStatus.disabled) return loadTimeData$2.substituteString(syncingLabel, email);
		return this.shownAccount_ && this.shownAccount_.isPrimaryAccount && this.promoType_ === PromoType.SYNC ? loadTimeData$2.substituteString(signedInLabel, email) : email;
	}
	shouldHideSubtitleWithAccountInfoText_() {
		if (this.hideButtons) return false;
		if (this.syncStatus.signedInState === SignedInState.SIGNED_IN_PAUSED) return true;
		if (this.syncStatus && this.syncStatus.hasError && this.syncStatus.statusText) return true;
		if (this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN) return true;
		return false;
	}
	getAvatarSubtitleLabel_(accountAwareRowSubtitle, pendingStateSubtitle, email) {
		if (this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN) return loadTimeData$2.substituteString(accountAwareRowSubtitle, email);
		if (this.syncStatus.signedInState === SignedInState.SIGNED_IN_PAUSED) return loadTimeData$2.substituteString(pendingStateSubtitle, email);
		if (this.syncStatus && this.syncStatus.hasError && this.syncStatus.statusText) {
			if (this.syncStatus.statusAction === StatusAction.ENTER_PASSPHRASE) return loadTimeData$2.substituteString(this.syncStatus.statusText, email);
			return this.syncStatus.statusText;
		}
		return "";
	}
	getAccountAwareSigninButtonLabel_(accountAwareSigninButtonLabel, givenName) {
		return loadTimeData$2.substituteString(accountAwareSigninButtonLabel, givenName);
	}
	getProfileImageSrc_(image, profileAvatarURL) {
		if (this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN) return profileAvatarURL;
		return image || "astro://theme/IDR_PROFILE_AVATAR_PLACEHOLDER_LARGE";
	}
	getAccountImageSrc_(image) {
		return image || "astro://theme/IDR_PROFILE_AVATAR_PLACEHOLDER_LARGE";
	}
	/**
	* @return The CSS class of the sync icon.
	*/
	getSyncIconStyle_() {
		if (this.syncStatus.disabled) return "sync-disabled";
		if (!this.syncStatus.hasError) return "sync";
		if (this.syncStatus.hasUnrecoverableError) return "sync-problem";
		if (this.syncStatus.statusAction === StatusAction.REAUTHENTICATE) return "sync-paused";
		return "sync-problem";
	}
	/**
	* Returned value must match one of iron-icon's settings:(*) icon name.
	*/
	getSyncIcon_() {
		switch (this.getSyncIconStyle_()) {
			case "sync-problem": return "settings:sync-problem";
			case "sync-paused": return "settings:sync-disabled";
			default: return "cr:sync";
		}
	}
	getAvatarRowTitle_(accountName, syncErrorLabel, syncPasswordsOnlyErrorLabel, authErrorLabel, disabledLabel, webOnlySignedInAccountRowTitle) {
		if (this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN) return webOnlySignedInAccountRowTitle;
		if (this.promoType_ === PromoType.SIGNIN && this.syncStatus.signedInState === SignedInState.SIGNED_IN) return accountName;
		if (this.syncStatus && this.syncStatus.hasError && this.syncStatus.statusText) return accountName;
		if (this.syncStatus.disabled) return disabledLabel;
		if (!this.syncStatus.hasError) return accountName;
		if (this.syncStatus.hasUnrecoverableError) return syncErrorLabel;
		if (this.syncStatus.statusAction === StatusAction.REAUTHENTICATE) return authErrorLabel;
		if (this.syncStatus.hasPasswordsOnlyError) return syncPasswordsOnlyErrorLabel;
		return syncErrorLabel;
	}
	/**
	* Determines if the signout button should be hidden.
	*/
	shouldHideSignoutButton_() {
		if (this.hideButtons) return true;
		if (this.syncStatus.domain) return true;
		return this.syncStatus.signedInState !== SignedInState.SIGNED_IN || this.syncStatus.statusAction !== StatusAction.NO_ACTION;
	}
	/**
	* Determines if the remove account button should be hidden.
	*/
	shouldHideRemoveAccountButton_() {
		return !!this.syncStatus.domain;
	}
	/**
	* Determines if the sync button should be disabled in response to
	* either a first setup flow or chrome sign-in being disabled.
	*/
	shouldDisableSyncButton_() {
		if (this.hideButtons || this.prefs === void 0) return this.computeShowSetupButtons_();
		return !this.syncStatus || !!this.syncStatus.firstSetupInProgress || !this.getPref("signin.allowed_on_next_startup").value;
	}
	/**
	* Determines whether the banner should be hidden, in the case where the user
	* has sync enabled or if the property to hide the banner was explicitly set.
	*/
	shouldHideBanner_() {
		if (this.hideBanner) return true;
		if (this.syncStatus && this.syncStatus.hasError && this.syncStatus.statusText) return true;
		switch (this.syncStatus.signedInState) {
			case SignedInState.SIGNED_IN:
			case SignedInState.SIGNED_OUT:
			case SignedInState.WEB_ONLY_SIGNED_IN: return false;
			case SignedInState.SYNCING:
			case SignedInState.SIGNED_IN_PAUSED: return true;
			case void 0: assertNotReached$1("Invalid SignedInState");
			default: assertNotReachedCase$1(this.syncStatus.signedInState, "Invalid SignedInState");
		}
	}
	/**
	* Determines whether the sync button should be hidden, in the case where
	* `replaceSyncPromosWithSignInPromos` is enabled, the user has sync enabled,
	* is in sign in paused, or if the property to hide the banner was explicitly
	* set.
	*/
	shouldHideSyncButton_() {
		if (this.promoType_ === PromoType.SIGNIN) return true;
		if (this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN) return true;
		if (this.syncStatus.statusAction !== StatusAction.NO_ACTION) return true;
		return this.hideButtons || !!this.syncStatus && (this.isSyncing_() || this.syncStatus.signedInState === SignedInState.SIGNED_IN_PAUSED);
	}
	shouldShowTurnOffButton_() {
		if (this.hideButtons || this.showSetupButtons_) return false;
		if (this.syncStatus.statusAction !== StatusAction.NO_ACTION) return true;
		return this.isSyncing_();
	}
	getTurnOffSyncLabel_(turnOffSync) {
		if (this.syncStatus.hasError && this.syncStatus.secondaryButtonActionText && this.isSyncing_()) return this.syncStatus.secondaryButtonActionText;
		if (this.syncStatus.statusAction !== StatusAction.NO_ACTION && this.syncStatus.secondaryButtonActionText) return this.syncStatus.secondaryButtonActionText;
		return turnOffSync;
	}
	shouldShowErrorActionButton_() {
		if (this.hideButtons || this.showSetupButtons_) return false;
		if (this.embeddedInSubpage && this.syncStatus.statusAction === StatusAction.ENTER_PASSPHRASE) return !this.isSyncing_();
		if (this.syncStatus.statusAction !== StatusAction.NO_ACTION) return true;
		return this.isSyncing_() && !!this.syncStatus.hasError && this.syncStatus.statusAction !== StatusAction.NO_ACTION;
	}
	shouldShowAccountAwareSigninButton_() {
		return !this.hideButtons && this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN;
	}
	shouldAllowAccountSwitch_() {
		if (this.hideButtons) return false;
		if (this.syncStatus.domain) return false;
		switch (this.syncStatus.signedInState) {
			case SignedInState.SIGNED_OUT:
			case SignedInState.WEB_ONLY_SIGNED_IN: return true;
			case SignedInState.SIGNED_IN_PAUSED:
			case SignedInState.SYNCING:
			case SignedInState.SIGNED_IN: return false;
			case void 0: assertNotReached$1("Invalid SignedInState");
			default: assertNotReachedCase$1(this.syncStatus.signedInState, "Invalid SignedInState");
		}
	}
	handleStoredAccounts_(accounts) {
		this.storedAccounts_ = accounts;
	}
	handleUpdateAvatar_(profileAvatarURL) {
		this.profileAvatarURL_ = profileAvatarURL;
	}
	computeShouldShowAvatarRow_() {
		if (this.storedAccounts_ === void 0 || this.syncStatus === void 0) return false;
		if (this.syncStatus.signedInState === SignedInState.WEB_ONLY_SIGNED_IN) return true;
		return this.isSyncing_() || this.storedAccounts_.length > 0;
	}
	onErrorButtonClick_() {
		const router = Router.getInstance();
		const routes = router.getRoutes();
		switch (this.syncStatus.statusAction) {
			case StatusAction.REAUTHENTICATE:
				this.syncBrowserProxy_.startSignIn(this.accessPoint);
				break;
			case StatusAction.UPGRADE_CLIENT:
				router.navigateTo(routes.ABOUT);
				break;
			case StatusAction.RETRIEVE_TRUSTED_VAULT_KEYS:
				this.syncBrowserProxy_.startKeyRetrieval();
				break;
			case StatusAction.ENTER_PASSPHRASE:
				this.syncBrowserProxy_.showSyncPassphraseDialog();
				break;
			case StatusAction.SHOW_BOOKMARKS_LIMIT_HELP_ARTICLE:
				this.syncBrowserProxy_.showBookmarkLimitExceededHelp();
				break;
			case StatusAction.CONFIRM_SYNC_SETTINGS:
			default: router.navigateTo(routes.SYNC);
		}
	}
	onSigninClick_() {
		this.syncBrowserProxy_.startSignIn(this.accessPoint);
		const actionMenu = this.shadowRoot.querySelector("cr-action-menu");
		if (actionMenu) actionMenu.close();
	}
	onSignoutClick_() {
		this.syncBrowserProxy_.signOut(false);
		const actionMenu = this.shadowRoot.querySelector("cr-action-menu");
		if (actionMenu) actionMenu.close();
	}
	onDropdownClose_() {
		const menuAnchor = this.shadowRoot.querySelector("#dropdown-arrow");
		assert$1(menuAnchor);
		menuAnchor.setAttribute("aria-expanded", "false");
	}
	onSyncButtonClick_() {
		assert$1(this.shownAccount_);
		assert$1(this.storedAccounts_.length > 0);
		const isDefaultPromoAccount = this.shownAccount_.email === this.storedAccounts_[0].email;
		this.syncBrowserProxy_.startSyncingWithEmail(this.shownAccount_.email, isDefaultPromoAccount);
	}
	onTurnOffButtonClick_() {
		if (!this.isSyncing_() && this.syncStatus.statusAction !== StatusAction.NO_ACTION) this.onSignoutClick_();
		const router = Router.getInstance();
		router.navigateTo(router.getRoutes().SIGN_OUT);
	}
	onMenuButtonClick_() {
		const actionMenu = this.shadowRoot.querySelector("cr-action-menu");
		assert$1(actionMenu);
		const anchor = this.shadowRoot.querySelector("#dropdown-arrow");
		assert$1(anchor);
		actionMenu.showAt(anchor);
		anchor.setAttribute("aria-expanded", "true");
	}
	onShouldShowAvatarRowChange_() {
		const actionMenu = this.shadowRoot.querySelector("cr-action-menu");
		if (!this.shouldShowAvatarRow_ && actionMenu && actionMenu.open) actionMenu.close();
	}
	onAccountClick_(e) {
		this.shownAccount_ = e.model.item;
		this.shadowRoot.querySelector("cr-action-menu").close();
	}
	onShownAccountShouldChange_() {
		if (this.storedAccounts_ === void 0 || this.syncStatus === void 0) return;
		if (this.isSyncing_()) {
			for (let i = 0; i < this.storedAccounts_.length; i++) if (this.storedAccounts_[i].email === this.syncStatus.signedInUsername) {
				this.shownAccount_ = this.storedAccounts_[i];
				return;
			}
		} else {
			const firstStoredAccount = this.storedAccounts_.length > 0 ? this.storedAccounts_[0] : null;
			const shouldRecordImpression = this.shownAccount_ === void 0 || !this.shownAccount_ && firstStoredAccount || this.shownAccount_ && !firstStoredAccount;
			this.shownAccount_ = firstStoredAccount;
			if (shouldRecordImpression) this.recordImpressionUserActions_();
		}
	}
	computeShowSetupButtons_() {
		return !this.hideButtons && !!this.syncStatus && !!this.syncStatus.firstSetupInProgress;
	}
	onSetupCancel_() {
		this.dispatchEvent(new CustomEvent("sync-setup-done", {
			bubbles: true,
			composed: true,
			detail: false
		}));
	}
	onSetupConfirm_() {
		this.dispatchEvent(new CustomEvent("sync-setup-done", {
			bubbles: true,
			composed: true,
			detail: true
		}));
	}
	computeShouldShowSigninPausedButtons_() {
		return !this.hideButtons && !!this.syncStatus && this.syncStatus.signedInState === SignedInState.SIGNED_IN_PAUSED;
	}
	maybeRecordSigninPendingOffered_() {
		if (!this.shouldShowSigninPausedButtons_) return;
		const currentRoute = Router.getInstance().getCurrentRoute();
		if (![
			routes.BASIC,
			routes.PEOPLE,
			routes.YOUR_SAVED_INFO
		].includes(currentRoute)) return;
		if (this.embeddedInSubpage) return;
		if (this.signinPausedImpressionRecorded_) return;
		this.syncBrowserProxy_.recordSigninPendingOffered();
		this.signinPausedImpressionRecorded_ = true;
	}
	isSyncing_() {
		return this.syncStatus.signedInState === SignedInState.SYNCING;
	}
};
customElements.define(SettingsSyncAccountControlElement.is, SettingsSyncAccountControlElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/base_mixin.js
var BaseMixin = dedupingMixin((superClass) => {
	class BaseMixin extends superClass {
		$$(query) {
			return this.shadowRoot.querySelector(query);
		}
		fire(eventName, detail) {
			this.dispatchEvent(new CustomEvent(eventName, {
				bubbles: true,
				composed: true,
				detail
			}));
		}
	}
	return BaseMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_checkbox_list_entry.html.js
function getTemplate$17() {
	return Ke`<!--_html_template_start_--><style include="settings-shared">.ripple-padding{padding-inline-start:20px;padding-inline-end:20px}cr-checkbox::part(label-container){min-width:0}</style>
<cr-checkbox id="checkbox" class="list-item no-outline ripple-padding"
    tab-index="-1" checked="{{checked}}" part="checkbox">
  <slot></slot>
</cr-checkbox>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/settings_checkbox_list_entry.js
var SettingsCheckboxListEntryElement = class extends PolymerElement {
	static get is() {
		return "settings-checkbox-list-entry";
	}
	static get template() {
		return getTemplate$17();
	}
	static get properties() {
		return {
			checked: {
				type: Boolean,
				value: false,
				observer: "onCheckedChanged_"
			},
			tabindex: {
				type: Number,
				value: 0,
				observer: "onTabIndexChanged_",
				reflectToAttribute: true
			}
		};
	}
	ready() {
		super.ready();
		this.addEventListener("click", this.onClick_);
		this.addEventListener("keydown", this.onKeyDown_);
		this.addEventListener("keyup", this.onKeyUp_);
	}
	onClick_() {
		this.$.checkbox.click();
	}
	onKeyDown_(e) {
		if (e.key !== " " && e.key !== "Enter") return;
		e.preventDefault();
		e.stopPropagation();
		if (e.repeat) return;
		if (e.key === "Enter") this.$.checkbox.click();
	}
	onKeyUp_(e) {
		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
		}
		if (e.key === " ") this.$.checkbox.click();
	}
	onCheckedChanged_() {
		this.setAttribute("aria-checked", String(this.$.checkbox.checked));
	}
	onTabIndexChanged_() {
		this.setAttribute("aria-hidden", this.tabindex >= 0 ? "false" : "true");
	}
};
customElements.define(SettingsCheckboxListEntryElement.is, SettingsCheckboxListEntryElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/tooltip_mixin.js
var TooltipMixin = dedupingMixin((superClass) => {
	class TooltipMixin extends superClass {
		showTooltipAtTarget(tooltip, target) {
			if (!tooltip.for) {
				tooltip.target = target;
				tooltip.updatePosition();
			}
			const hide = () => {
				tooltip.hide();
				target.removeEventListener("mouseleave", hide);
				target.removeEventListener("blur", hide);
				target.removeEventListener("click", hide);
				tooltip.removeEventListener("mouseenter", hide);
			};
			target.addEventListener("mouseleave", hide);
			target.addEventListener("blur", hide);
			target.addEventListener("click", hide);
			tooltip.addEventListener("mouseenter", hide);
			tooltip.show();
		}
	}
	return TooltipMixin;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/collapse_radio_button.html.js
function getTemplate$16() {
	return Ke`<!--_html_template_start_-->    <style include="settings-shared cr-radio-button-style">:host{display:block}:host([disabled]){opacity:1}cr-policy-pref-indicator,:host([disabled]) cr-expand-button{pointer-events:auto}:host([disabled]) .disc-wrapper{opacity:var(--cr-disabled-opacity)}:host([disabled]) #labelWrapper{opacity:1}cr-collapse{margin-inline-end:0;margin-inline-start:calc(var(--cr-radio-button-label-spacing,20px) + var(--cr-radio-button-size))}.disc-wrapper{margin-inline-end:var(--cr-radio-button-label-spacing,20px)}.separator{margin-inline-end:0;min-height:calc(var(--settings-collapse-toggle-min-height,48px) / 2)}#borderWrapper{align-items:center;border-top:var(--settings-collapse-separator-line);display:flex;min-height:var(--settings-collapse-toggle-min-height);width:100%}#buttonIcon{padding-inline-end:6px}#labelWrapper{--cr-radio-button-label-spacing:0}#radioCollapse{align-items:center;display:flex}slot[name='noSelectionCollapse']{cursor:auto}
    </style>
    <div id="radioCollapse">
      <div aria-checked$="[[getAriaChecked_(checked)]]"
          aria-disabled$="[[getAriaDisabled_(disabled)]]"
          aria-labelledby="label"
          aria-describedby="sub-label"
          class="disc-wrapper"
          id="button"
          role="radio"
          tabindex$="[[buttonTabIndex_]]"
          on-focus="onRadioFocus_"
          on-keydown="onInputKeydown_">
        <div class="disc-border"></div>
        <div class="disc"></div>
      </div>
      <div id="borderWrapper">
        <cr-icon id="buttonIcon" icon="[[icon]]" hidden$="[[!icon]]"></cr-icon>
        <div id="labelWrapper" class="cr-padded-text">
          <div id="label" aria-hidden="true">
            [[label]]
            <slot name="label"></slot>
          </div>
          <div hidden$="[[!subLabel]]" id="sub-label" class="secondary">
            [[subLabel]]
            <slot name="sub-label"></slot>
          </div>
        </div>
        <template is="dom-if" if="[[pref]]">
          <cr-policy-pref-indicator pref="[[pref]]"
              icon-aria-label="[[indicatorAriaLabel]]"
              associated-value="[[name]]" on-focus="onNonRadioFocus_">
          </cr-policy-pref-indicator>
        </template>
        <div hidden$="[[noCollapse]]" class="separator"></div>
        <cr-expand-button id="expandButton" no-hover
              aria-label="[[expandAriaLabel]]"
              hidden$="[[noCollapse]]" expanded="{{expanded}}"
              on-click="onExpandClicked_"
              on-focus="onNonRadioFocus_">
        </cr-expand-button>
      </div>
    </div>

    <cr-collapse opened="[[expanded]]">
      <slot name="collapse"></slot>
      <slot name="noSelectionCollapse"></slot>
    </cr-collapse>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/controls/collapse_radio_button.js
var SettingsCollapseRadioButtonElementBase = CrRippleMixinPolymer(CrRadioButtonMixin(PolymerElement));
var SettingsCollapseRadioButtonElement = class extends SettingsCollapseRadioButtonElementBase {
	static get is() {
		return "settings-collapse-radio-button";
	}
	static get template() {
		return getTemplate$16();
	}
	static get properties() {
		return {
			expanded: {
				type: Boolean,
				notify: true,
				value: false
			},
			noAutomaticCollapse: {
				type: Boolean,
				value: false
			},
			noCollapse: Boolean,
			label: String,
			indicatorAriaLabel: String,
			icon: {
				type: String,
				value: ""
			},
			pref: Object,
			disabled: {
				type: Boolean,
				value: false,
				reflectToAttribute: true
			},
			subLabel: {
				type: String,
				value: ""
			},
			expandAriaLabel: String
		};
	}
	static get observers() {
		return ["onCheckedChanged_(checked)", "onPrefChanged_(pref.*)"];
	}
	pendingUpdateCollapsed_;
	constructor() {
		super();
		/**
		* Tracks if this button was clicked but wasn't expanded.
		*/
		this.pendingUpdateCollapsed_ = false;
	}
	getPaperRipple() {
		return this.getRipple();
	}
	createRipple() {
		this.rippleContainer = this.shadowRoot.querySelector(".disc-wrapper");
		const ripple = super.createRipple();
		ripple.setAttribute("recenters", "");
		ripple.classList.add("circle");
		return ripple;
	}
	/**
	* Updates the collapsed status of this radio button to reflect
	* the user selection actions.
	*/
	updateCollapsed() {
		if (this.pendingUpdateCollapsed_) {
			this.pendingUpdateCollapsed_ = false;
			this.expanded = this.checked;
		}
	}
	getBubbleAnchor() {
		const anchor = this.shadowRoot.querySelector("#button");
		assert(anchor);
		return anchor;
	}
	onCheckedChanged_() {
		this.pendingUpdateCollapsed_ = true;
		if (!this.noAutomaticCollapse) this.updateCollapsed();
	}
	onPrefChanged_() {
		this.disabled = !!this.pref && this.pref.enforcement === chrome.settingsPrivate.Enforcement.ENFORCED && !(!!this.pref.userSelectableValues && this.pref.userSelectableValues.includes(this.name));
	}
	onExpandClicked_() {
		this.dispatchEvent(new CustomEvent("expand-clicked", {
			bubbles: true,
			composed: true
		}));
	}
	onRadioFocus_() {
		this.getRipple().showAndHoldDown();
	}
	/**
	* Clear the ripple associated with the radio button when the expand button
	* is focused. Stop propagation to prevent the ripple being re-created.
	*/
	onNonRadioFocus_(e) {
		this.getRipple().clear();
		e.stopPropagation();
	}
};
customElements.define(SettingsCollapseRadioButtonElement.is, SettingsCollapseRadioButtonElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/settings_columned_section.css.js
var styleMod$2 = document.createElement("dom-module");
styleMod$2.appendChild(html`
  <template>
    <style>
.settings-columned-section{display:flex;gap:16px;padding:16px var(--cr-section-padding) 0}settings-collapse-radio-button .settings-columned-section{padding:4px 0 16px 0}.settings-columned-section .column{flex:1;min-width:0}.settings-columned-section .description-header{color:var(--google-blue-600)}.settings-columned-section h2.description-header,.settings-columned-section h3.description-header,.settings-columned-section h4.description-header{font-size:inherit;font-weight:400;margin:0;padding:0}@media (prefers-color-scheme:dark){.settings-columned-section .description-header{color:var(--google-blue-300)}}.settings-columned-section ul{list-style-type:none;padding-inline-start:0}.settings-columned-section ul.icon-bulleted-list li{column-gap:16px;display:flex}.settings-columned-section li{margin:16px 0}
    </style>
  </template>
`.content);
styleMod$2.register("settings-columned-section");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/performance_page/constants.js
/**
* Must be kept in sync with the C++ enum of the same name (see
* chrome/browser/preloading/preloading_prefs.h).
*/
var NetworkPredictionOptions;
(function(NetworkPredictionOptions) {
	NetworkPredictionOptions[NetworkPredictionOptions["STANDARD"] = 0] = "STANDARD";
	NetworkPredictionOptions[NetworkPredictionOptions["WIFI_ONLY_DEPRECATED"] = 1] = "WIFI_ONLY_DEPRECATED";
	NetworkPredictionOptions[NetworkPredictionOptions["DISABLED"] = 2] = "DISABLED";
	NetworkPredictionOptions[NetworkPredictionOptions["EXTENDED"] = 3] = "EXTENDED";
	NetworkPredictionOptions[NetworkPredictionOptions["DEFAULT"] = 1] = "DEFAULT";
})(NetworkPredictionOptions || (NetworkPredictionOptions = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/safety_hub/safety_hub_module.html.js
function getTemplate$15() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">:host{display:block;--separator-line-height:16px;--cr-icon-button-margin-end:0}#headerWrapper{align-items:center;display:flex;flex:1}#headerTextWrapper{flex-direction:column;flex:1;margin-inline-end:24px}#header,#subheader,.display-name{font-size:0.8125rem}#header{margin:0;font-weight:500}#headerWrapper{min-height:calc(2em * 1.54)}cr-icon{--iron-icon-height:20px;--iron-icon-width:20px}cr-icon.green{--iron-icon-fill-color:var(--google-green-700)}cr-icon.blue{--iron-icon-fill-color:var(--google-blue-600)}@media (prefers-color-scheme:dark){cr-icon.green{--iron-icon-fill-color:var(--google-green-300)}cr-icon.blue{--iron-icon-fill-color:var(--google-blue-300)}}.list-item{clip-path:polygon(0 0,0 100%,100% 100%,100% 0)}.display-name{flex:1;max-width:100%}site-favicon,#headerIcon,.item-icon{padding-inline-end:16px}#line{box-sizing:border-box;height:var(--separator-line-height);border-bottom:1px solid var(--cr-separator-color);flex:1}cr-tooltip{--paper-tooltip-min-width:max-content}</style>

<template is="dom-if" if="[[animated]]">
  <style>
    :host {
      /**
       * The |animation-duration| parameter corresponds to MODEL_UPDATE_DELAY_MS
       * in the .ts file.
       */
      --animation-duration: 300ms;
    }

    #headerWrapper {
      /**
       * Increse the header height to 3 lines. This is because the header
       * currently isn't animated, only the rows under it are. When we animate
       * the showing or hiding of rows, and at the end we update the header from
       * little content to a lot of content or vice versa, this may change the
       * header's height and appear as a "bump" at the beginning or end of the
       * animation. 3 lines should be a sufficient buffer for headers with a lot
       * of content.
       *
       * We also need to count with 154% line-height.
       */
      min-height: calc(3em * 1.54);
    }

    @keyframes line-hiding-animation {
      0% {
        height: var(--separator-line-height);
        opacity: 1;
      }
      100% {
        height: 0;
        opacity: 0;
        visibility: hidden;
      }
    }

    /**
     * Settings use a line height of 154%. Our items contain two lines (2em)
     * plus a vertical padding on both sides. We slightly increase
     * the coefficient to 160% to avoid that the height immediately contracts at
     * the beginning of the animation in case of rounding error. Note that
     * erring on the side of a slightly larger height is not a problem since
     * this animation uses |max-height| and not |height| directly.
     */
    @keyframes item-hiding-animation {
      0% {
        max-height: calc(1.6 * 2em + 2 * var(--cr-section-vertical-padding));
        opacity: 1;
      }
      100% {
        max-height: 0;
        opacity: 0;
        visibility: hidden;
      }
    }

    /**
     * When new items are added to the list, they must immediately be set
     * invisible. Otherwise, there flash on the screen for a moment before we
     * have a chance to apply the ".showing" animation that is supposed to start
     * with the item not being visible.
     *
     * At any other phase of the animation, while the item is shown or hidden,
     * or when the item is in a steady state, this is overriden to make the item
     * visible.
     */
    #siteList .list-item, #line {
      display: none;
    }

    #siteList .list-item.hiding, #siteList .list-item.showing,
    #line.hiding, #line.showing {
      display: flex;
    }

    /**
     * Showing and hiding animations are largely symmetrical. They only differ
     * in the direction and timing.
     */
    .hiding, .showing {
      animation-duration: var(--animation-duration);
      animation-fill-mode: forwards;
      animation-iteration-count: 1;
      animation-name: item-hiding-animation;
      animation-timing-function: cubic-bezier(0, 0.8, 0, 1);
      min-height: 0;
    }

    .showing {
      animation-direction: reverse;
      animation-timing-function: cubic-bezier(1, 0, 1, 0.4);
    }

    #line.hiding, #line.showing {
      animation-name: line-hiding-animation;
    }
  </style>
</template>

<div id="headerWrapper">
  <template is="dom-if" if="[[headerIcon]]">
    <cr-icon id="headerIcon"
      icon="[[headerIcon]]" class$="[[headerIconColor]]">
    </cr-icon>
  </template>
  <div id="headerTextWrapper">
    <h3 id="header">[[header]]</h3>
    <div id="subheader" class="cr-secondary-text">[[subheader]]</div>
  </div>
  <slot name="button-container"></slot>
</div>

<template is="dom-if" if="[[sites.length]]">
  <div id="line"></div>
  <div id="siteList">
    <template is="dom-repeat" items="[[sites]]">
      <div class="list-item site-entry">
        <template is="dom-if" if="[[item.icon]]">
          <cr-icon class="item-icon" icon="[[item.icon]]"></cr-icon>
        </template>
        <template is="dom-if" if="[[!item.icon]]">
          <site-favicon url="[[item.origin]]"></site-favicon>
        </template>
        <div class="display-name cr-padded-text">
          <div class="site-representation">[[item.origin]]</div>
          <div class="cr-secondary-text link"
              inner-h-t-m-l="[[sanitizeInnerHtml_(item.detail)]]">
          </div>
        </div>
        <template is="dom-if" if="[[buttonIcon]]">
          <cr-icon-button iron-icon="[[buttonIcon]]" id="mainButton"
              on-click="onItemButtonClick_" actionable
              aria-label$="[[getButtonAriaLabelForOrigin_(item.origin)]]"
              on-focus="onShowTooltip_" on-mouseenter="onShowTooltip_">
          </cr-icon-button>
        </template>
        <template is="dom-if" if="[[moreActionVisible]]">
          <cr-icon-button class="icon-more-vert" id="moreActionButton"
              on-click="onMoreActionClick_" title="$i18n{moreActions}"
              aria-label$="[[getMoreButtonAriaLabelForOrigin_(item.origin)]]"
              actionable>
          </cr-icon-button>
        </template>
      </div>
    </template>
  </div>
  <cr-tooltip fit-to-visible-bounds manual-mode position="top" offset="3">
    [[buttonTooltipText]]
  </cr-tooltip>
</template>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/safety_hub/safety_hub_module.js
/**
* Corresponds to the animation-duration CSS parameter defined
* in review_notification_permissions.html. Set to be slightly higher, as we
* want to ensure that the animation is finished before updating the model for
* the right visual effect.
*/
var MODEL_UPDATE_DELAY_MS = 310;
var SettingsSafetyHubModuleElementBase = TooltipMixin(I18nMixin(PolymerElement));
var SettingsSafetyHubModuleElement = class extends SettingsSafetyHubModuleElementBase {
	static get is() {
		return "settings-safety-hub-module";
	}
	static get template() {
		return getTemplate$15();
	}
	static get properties() {
		return {
			sites: {
				type: Array,
				value: () => [],
				observer: "onSitesChanged_"
			},
			animated: {
				type: Boolean,
				value: false
			},
			header: String,
			subheader: String,
			headerIcon: {
				String,
				observer: "onHeaderIconChanged_"
			},
			headerIconColor: String,
			buttonIcon: String,
			buttonAriaLabelId: String,
			buttonTooltipText: String,
			moreActionVisible: {
				type: Boolean,
				value: false
			},
			moreButtonAriaLabelId: String
		};
	}
	modelUpdateDelayMsForTesting_ = null;
	setModelUpdateDelayMsForTesting(delayMs) {
		this.modelUpdateDelayMsForTesting_ = delayMs;
	}
	setVisibility_(item, visible) {
		item.style.display = visible ? "flex" : "";
	}
	addItemLinkClickListeners(items) {
		for (const item of items) item.querySelectorAll("a").forEach((link) => {
			if (link.target === "_blank") link.setAttribute("aria-description", this.i18n("opensInNewTab"));
			link.addEventListener("click", function() {
				this.dispatchEvent(new CustomEvent("sh-module-item-link-click", {
					bubbles: true,
					composed: true,
					detail: item
				}));
			});
		});
	}
	onSitesChanged_() {
		const items = this.shadowRoot.querySelectorAll("#siteList .list-item");
		for (const item of items) this.setVisibility_(item, true);
		if (this.sites && this.sites.length !== items.length) setTimeout(this.onSitesChanged_.bind(this), 0);
		this.addItemLinkClickListeners(items);
	}
	/**
	* Hides |origin| and when the animation finishes, calls |callback|. If
	* |origin| is null, all origins are hidden.
	*
	* The |callback| method MUST be provided and MUST remove the |origin| from
	* the underlying model.
	*/
	animateHide(origin, callback) {
		const items = this.shadowRoot.querySelectorAll("#siteList .list-item");
		if (items.length !== this.sites.length) {
			setTimeout(this.animateHide.bind(this, origin, callback), 0);
			return;
		}
		let removedAll = origin === null;
		for (let i = 0; i < this.sites.length; ++i) if (origin === null || origin === this.sites[i].origin) {
			items[i].classList.add("hiding");
			if (origin) {
				removedAll ||= this.sites.length === 1;
				break;
			}
		}
		if (removedAll) this.shadowRoot.querySelector("#line").classList.add("hiding");
		const delayMs = this.modelUpdateDelayMsForTesting_ !== null ? this.modelUpdateDelayMsForTesting_ : MODEL_UPDATE_DELAY_MS;
		if (callback) setTimeout(callback, delayMs);
		setTimeout(this.finalizeAnimation_.bind(this), delayMs);
	}
	/**
	* Shows the given |origins| and calls |callback|.
	*
	* MUST be called once for each origin added, right after it is added.
	*/
	animateShow(origins, callback) {
		const items = this.shadowRoot.querySelectorAll("#siteList .list-item");
		if (items.length !== this.sites.length) {
			setTimeout(this.animateShow.bind(this, origins, callback), 0);
			return;
		}
		let wasEmpty = true;
		for (let i = 0; i < items.length; ++i) if (origins.includes(this.sites[i].origin)) items[i].classList.add("showing");
		else wasEmpty = false;
		if (wasEmpty) this.shadowRoot.querySelector("#line").classList.add("showing");
		const delayMs = this.modelUpdateDelayMsForTesting_ !== null ? this.modelUpdateDelayMsForTesting_ : MODEL_UPDATE_DELAY_MS;
		if (callback) setTimeout(callback, delayMs);
		setTimeout(this.finalizeAnimation_.bind(this), delayMs);
	}
	/** Focus the main button for the given |origin|, if it exists. */
	focusOriginMainButton(origin) {
		for (const item of this.shadowRoot.querySelectorAll("#siteList .list-item")) {
			const siteRepresentation = item.querySelector(".site-representation");
			if (siteRepresentation && siteRepresentation.innerHTML === origin) {
				item.querySelector("#mainButton").focus();
				return;
			}
		}
	}
	finalizeAnimation_() {
		const items = this.shadowRoot.querySelectorAll("#siteList .list-item, #line");
		for (const item of items) {
			if (item.classList.contains("showing")) {
				item.classList.remove("showing");
				this.setVisibility_(item, true);
			}
			if (item.classList.contains("hiding")) {
				item.classList.remove("hiding");
				this.setVisibility_(item, false);
			}
		}
	}
	onItemButtonClick_(e) {
		const item = e.model.item;
		this.dispatchEvent(new CustomEvent("sh-module-item-button-click", {
			bubbles: true,
			composed: true,
			detail: item
		}));
	}
	onMoreActionClick_(e) {
		const item = {
			...e.model.item,
			target: e.target
		};
		this.dispatchEvent(new CustomEvent("sh-module-more-action-button-click", {
			bubbles: true,
			composed: true,
			detail: item
		}));
	}
	onHeaderIconChanged_() {
		if (this.headerIcon === "cr:check") this.headerIconColor = "green";
		else if (this.headerIcon !== "cr:security") this.headerIconColor = "";
	}
	onShowTooltip_(e) {
		e.stopPropagation();
		const tooltip = this.shadowRoot.querySelector("cr-tooltip");
		assert(tooltip);
		this.showTooltipAtTarget(tooltip, e.target);
	}
	sanitizeInnerHtml_(rawString) {
		return sanitizeInnerHtml(rawString);
	}
	getButtonAriaLabelForOrigin_(origin) {
		return this.i18n(this.buttonAriaLabelId, origin);
	}
	getMoreButtonAriaLabelForOrigin_(origin) {
		return this.i18n(this.moreButtonAriaLabelId, origin);
	}
};
customElements.define(SettingsSafetyHubModuleElement.is, SettingsSafetyHubModuleElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/safety_hub/safety_hub_browser_proxy.js
/**
* @fileoverview A helper object used by the "Site Settings" to interact with
* the permission-related updates of the browser.
*/
/**
* Constants used in safety hub C++ to JS communication.
* Their values need be kept in sync with their counterparts in
* chrome/browser/ui/webui/settings/safety_hub_handler.h and
* chrome/browser/ui/webui/settings/safety_hub_handler.cc
*/
var SafetyHubEvent;
(function(SafetyHubEvent) {
	SafetyHubEvent["UNUSED_PERMISSIONS_MAYBE_CHANGED"] = "unused-permission-review-list-maybe-changed";
	SafetyHubEvent["NOTIFICATION_PERMISSIONS_MAYBE_CHANGED"] = "notification-permission-review-list-maybe-changed";
	SafetyHubEvent["EXTENSIONS_CHANGED"] = "extensions-review-list-maybe-changed";
})(SafetyHubEvent || (SafetyHubEvent = {}));
var PermissionsRevocationType;
(function(PermissionsRevocationType) {
	PermissionsRevocationType[PermissionsRevocationType["UNUSED_PERMISSIONS"] = 0] = "UNUSED_PERMISSIONS";
	PermissionsRevocationType[PermissionsRevocationType["ABUSIVE_NOTIFICATION_PERMISSIONS"] = 1] = "ABUSIVE_NOTIFICATION_PERMISSIONS";
	PermissionsRevocationType[PermissionsRevocationType["DISRUPTIVE_NOTIFICATION_PERMISSIONS"] = 2] = "DISRUPTIVE_NOTIFICATION_PERMISSIONS";
	PermissionsRevocationType[PermissionsRevocationType["UNUSED_PERMISSIONS_AND_ABUSIVE_NOTIFICATIONS"] = 3] = "UNUSED_PERMISSIONS_AND_ABUSIVE_NOTIFICATIONS";
	PermissionsRevocationType[PermissionsRevocationType["UNUSED_PERMISSIONS_AND_DISRUPTIVE_NOTIFICATIONS"] = 4] = "UNUSED_PERMISSIONS_AND_DISRUPTIVE_NOTIFICATIONS";
	PermissionsRevocationType[PermissionsRevocationType["SUSPICIOUS_NOTIFICATION_PERMISSIONS"] = 5] = "SUSPICIOUS_NOTIFICATION_PERMISSIONS";
	PermissionsRevocationType[PermissionsRevocationType["UNUSED_PERMISSIONS_AND_SUSPICIOUS_NOTIFICATIONS"] = 6] = "UNUSED_PERMISSIONS_AND_SUSPICIOUS_NOTIFICATIONS";
})(PermissionsRevocationType || (PermissionsRevocationType = {}));
/**
* A Safety Hub card has 4 different states as represented below. Depending on
* the card state, the card will be updated.
* Should be kept in sync with the corresponding enum in
* chrome/browser/ui/safety_hub/safety_hub_constants.h.
*/
var CardState;
(function(CardState) {
	CardState[CardState["WARNING"] = 0] = "WARNING";
	CardState[CardState["WEAK"] = 1] = "WEAK";
	CardState[CardState["INFO"] = 2] = "INFO";
	CardState[CardState["SAFE"] = 3] = "SAFE";
})(CardState || (CardState = {}));
var SafetyHubBrowserProxyImpl = class SafetyHubBrowserProxyImpl {
	acknowledgeRevokedUnusedSitePermissionsList() {
		chrome.send("acknowledgeRevokedUnusedSitePermissionsList");
	}
	allowPermissionsAgainForUnusedSite(origin) {
		chrome.send("allowPermissionsAgainForUnusedSite", [origin]);
	}
	getRevokedUnusedSitePermissionsList() {
		return sendWithPromise("getRevokedUnusedSitePermissionsList");
	}
	undoAcknowledgeRevokedUnusedSitePermissionsList(unusedSitePermissionsList) {
		chrome.send("undoAcknowledgeRevokedUnusedSitePermissionsList", [unusedSitePermissionsList]);
	}
	undoAllowPermissionsAgainForUnusedSite(unusedSitePermissions) {
		chrome.send("undoAllowPermissionsAgainForUnusedSite", [unusedSitePermissions]);
	}
	getNotificationPermissionReview() {
		return sendWithPromise("getNotificationPermissionReview");
	}
	blockNotificationPermissionForOrigins(origins) {
		chrome.send("blockNotificationPermissionForOrigins", [origins]);
	}
	allowNotificationPermissionForOrigins(origins) {
		chrome.send("allowNotificationPermissionForOrigins", [origins]);
	}
	ignoreNotificationPermissionForOrigins(origins) {
		chrome.send("ignoreNotificationPermissionReviewForOrigins", [origins]);
	}
	undoIgnoreNotificationPermissionForOrigins(origins) {
		chrome.send("undoIgnoreNotificationPermissionReviewForOrigins", [origins]);
	}
	resetNotificationPermissionForOrigins(origins) {
		chrome.send("resetNotificationPermissionForOrigins", [origins]);
	}
	dismissActiveMenuNotification() {
		chrome.send("dismissActiveMenuNotification");
	}
	getPasswordCardData() {
		return sendWithPromise("getPasswordCardData");
	}
	getSafeBrowsingCardData() {
		return sendWithPromise("getSafeBrowsingCardData");
	}
	getVersionCardData() {
		return sendWithPromise("getVersionCardData");
	}
	getNumberOfExtensionsThatNeedReview() {
		return sendWithPromise("getNumberOfExtensionsThatNeedReview");
	}
	getSafetyHubEntryPointData() {
		return sendWithPromise("getSafetyHubEntryPointData");
	}
	recordSafetyHubPageVisit() {
		return sendWithPromise("recordSafetyHubPageVisit");
	}
	recordSafetyHubInteraction() {
		return sendWithPromise("recordSafetyHubInteraction");
	}
	static getInstance() {
		return instance$12 || (instance$12 = new SafetyHubBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$12 = obj;
	}
};
var instance$12 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/safety_hub/safety_hub_entry_point.html.js
function getTemplate$14() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style">#module{padding:8px 16px}</style>

<settings-section page-title="$i18n{safetyHub}">
  <settings-safety-hub-module class="cr-row first" id="module"
      header$="[[headerString_]]" subheader$="[[subheaderString_]]"
      header-icon-color$="[[headerIconColor_]]" header-icon="cr:security">
    <cr-button id="button" on-click="onClick_" slot="button-container"
        class$="[[buttonClass_]]">
      $i18n{safetyHubEntryPointButtonLabel}
    </cr-button>
  </settings-safety-hub-module>
</settings-section>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/safety_hub/safety_hub_entry_point.js
var SettingsSafetyHubEntryPointElementBase = SettingsViewMixin(RouteObserverMixin(I18nMixin(PolymerElement)));
var SettingsSafetyHubEntryPointElement = class extends SettingsSafetyHubEntryPointElementBase {
	static get is() {
		return "settings-safety-hub-entry-point";
	}
	static get template() {
		return getTemplate$14();
	}
	static get properties() {
		return {
			buttonClass_: {
				type: Boolean,
				computed: "computeButtonClass_(hasRecommendations_)"
			},
			hasRecommendations_: {
				type: Boolean,
				value: false
			},
			headerString_: String,
			subheaderString_: String,
			headerIconColor_: {
				type: String,
				computed: "computeHeaderIconColor_(hasRecommendations_)"
			}
		};
	}
	safetyHubBrowserProxy_ = SafetyHubBrowserProxyImpl.getInstance();
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	connectedCallback() {
		this.safetyHubBrowserProxy_.getSafetyHubEntryPointData().then((entryPoint) => {
			this.hasRecommendations_ = entryPoint.hasRecommendations;
			this.headerString_ = entryPoint.header;
			this.subheaderString_ = entryPoint.subheader;
		});
		super.connectedCallback();
	}
	currentRouteChanged(newRoute, oldRoute) {
		super.currentRouteChanged(newRoute, oldRoute);
		if (Router.getInstance().getCurrentRoute() !== routes.PRIVACY) return;
		if (this.hasRecommendations_) this.metricsBrowserProxy_.recordSafetyHubEntryPointShown(SafetyHubEntryPoint.PRIVACY_WARNING);
		else this.metricsBrowserProxy_.recordSafetyHubEntryPointShown(SafetyHubEntryPoint.PRIVACY_SAFE);
	}
	computeButtonClass_() {
		return this.hasRecommendations_ ? "action-button" : "";
	}
	computeHeaderIconColor_() {
		return this.hasRecommendations_ ? "blue" : "";
	}
	onClick_() {
		if (this.hasRecommendations_) this.metricsBrowserProxy_.recordSafetyHubEntryPointClicked(SafetyHubEntryPoint.PRIVACY_WARNING);
		else this.metricsBrowserProxy_.recordSafetyHubEntryPointClicked(SafetyHubEntryPoint.PRIVACY_SAFE);
		Router.getInstance().navigateTo(routes.SAFETY_HUB);
	}
	getFocusConfig() {
		return /* @__PURE__ */ new Map([[routes.SAFETY_HUB.path, "#button"]]);
	}
};
customElements.define(SettingsSafetyHubEntryPointElement.is, SettingsSafetyHubEntryPointElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_icons.html.js
var div = document.createElement("div");
div.innerHTML = getTrustedHTML`<!-- Icons used in the privacy_page/*, site_settings/* and site_settings_page/*
 pages. Keep in alphabetical ordering. -->
<cr-iconset name="privacy20" size="20">
  <svg>
    <defs>
      <g id="ads-click" viewBox="0 -960 960 960">
        <path d="M480-240q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170l-73-24q-9-62-56.5-103T480-648q-70 0-119 49t-49 119q0 63 41 110.5T456-313l24 73Zm44 141q-11 2-22 2.5t-22 .5q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 11-.5 22t-1.5 22l-70-22v-22q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91q5 0 11-.5t11-.5l22 70Zm296 27L654-239 600-96 480-480l384 120-143 53 167 167-68 68Z"></path>
      </g>
      <g id="person-check" viewBox="0 -960 960 960">
        <path d="M695-456 576-575l51-51 68 68 153-152 51 50-204 204Zm-311-24q-60 0-102-42t-42-102q0-60 42-102t102-42q60 0 102 42t42 102q0 60-42 102t-102 42ZM96-192v-92q0-25.78 12.5-47.39T143-366q55-32 116-49t125-17q64 0 125 17t116 49q22 13 34.5 34.61T672-284v92H96Zm72-72h432v-20q0-6.47-3.03-11.76-3.02-5.3-7.97-8.24-47-27-99-41.5T384-360q-54 0-106 14.5T179-304q-4.95 2.94-7.98 8.24Q168-290.47 168-284v20Zm216.21-288Q414-552 435-573.21t21-51Q456-654 434.79-675t-51-21Q354-696 333-674.79t-21 51Q312-594 333.21-573t51 21ZM384-312Zm0-312Z"></path>
      </g>
      <g id="signpost" viewBox="0 -960 960 960">
        <path d="M444-96v-192H240l-96-108 96-108h204v-72H192v-216h252v-72h72v72h204l96 108-96 108H516v72h252v216H516v192h-72ZM264-648h424l32-36-32-36H264v72Zm8 288h424v-72H272l-32 36 32 36Zm-8-288v-72 72Zm432 288v-72 72Z"></path>
      </g>
    </defs>
  </svg>
</cr-iconset>
<cr-iconset name="privacy" size="24">
  <svg>
    <defs>
      <g id="account-circle" viewBox="0 -960 960 960">
        <path d="M237-285q54-38 115.5-56.5T480-360q66 0 127.5 18.5T723-285q35-41 52-91t17-104q0-129.67-91.23-220.84-91.23-91.16-221-91.16Q350-792 259-700.84 168-609.67 168-480q0 54 17 104t52 91Zm243-123q-60 0-102-42t-42-102q0-60 42-102t102-42q60 0 102 42t42 102q0 60-42 102t-102 42Zm.28 312Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Zm-.28-72q52 0 100-16.5t90-48.5q-43-27-91-41t-99-14q-51 0-99.5 13.5T290-233q42 32 90 48.5T480-168Zm0-312q30 0 51-21t21-51q0-30-21-51t-51-21q-30 0-51 21t-21 51q0 30 21 51t51 21Zm0-72Zm0 319Z"></path>
      </g>
      <g id="account-circle-off" viewBox="0 -960 960 960">
        <path d="M527-535ZM420-420Zm59.96 252Q532-168 580-184.5q48-16.5 90-48.5-43-27-91-41t-99-14q-51 0-99.5 13.5T290-233q42 32 89.96 48.5 47.96 16.5 100 16.5ZM595-466l-52-52q5-8 7-16.67 2-8.66 2-17.33 0-30-21-51t-51-21q-8.67 0-17.33 2-8.67 2-16.67 7l-52-52q19-14 41-21.5t45-7.5q59.66 0 101.83 42.17T624-552q0 23-7.5 45T595-466Zm202 202-52-52q23-37 35-78.66 12-41.65 12-85.34 0-130-91-221t-221-91q-43.69 0-85.34 12Q353-768 316-745l-52-52q48-33 103.02-50 55.02-17 112.98-17 80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 57.96-17 112.98T797-264ZM480-96q-79.38 0-149.19-30T208.5-208.5Q156-261 126-330.81T96-480q0-57.62 17-112.31Q130-647 162-695l-72-73 51-51 678 678-51 51-554-553q-23 37-34.5 78T168-480q0 54 17 104t52 91q54-38 115.41-56.5Q413.83-360 479.66-360q37.34 0 73.34 6.5t71 18.5l127 127q-54 54-124.09 83Q556.81-96 480-96Z"></path>
      </g>
      <g id="cardboard" viewBox="0 -960 960 960">
        <path d="M216-336h153l29.75-58.35Q411-417 432.5-430.5t47.49-13.5q25.99 0 47.5 13T561-395.08L591-336h153v-288H216v288Zm96.21-72Q342-408 363-429.21t21-51Q384-510 362.79-531t-51-21Q282-552 261-530.79t-21 51Q240-450 261.21-429t51 21ZM144-336.06v-288.22Q144-654 165.15-675T216-696h528q29.7 0 50.85 21.17Q816-653.67 816-623.94v288.22Q816-306 794.85-285T744-264H591q-20 0-37.5-10.5T527-303l-30-58q-2.57-5.08-7.29-8.04Q485-372 480-372q-5 0-10 3t-7 8l-30 58q-9 18-26.5 28.5T369-264H216q-29.7 0-50.85-21.17Q144-306.33 144-336.06ZM648.21-408Q678-408 699-429.21t21-51Q720-510 698.79-531t-51-21Q618-552 597-530.79t-21 51Q576-450 597.21-429t51 21ZM480-480Z"></path>
      </g>
      <g id="cardboard-off" viewBox="0 -960 960 960">
        <path d="M768-90 90-768l51-51 678 678-51 51ZM378-480Zm417 195-51-51.25V-624H437l-71-72h378q29.7 0 50.85 21.13Q816-653.73 816-624.06v287.77q0 15.29-5.48 28.34T795-285ZM311.79-408Q282-408 261-429.21t-21-51Q240-510 261.21-531t51-21Q342-552 363-530.79t21 51Q384-450 362.79-429t-51 21ZM650-408l-74-75q2-29 22.5-49t49.5-20q29.7 0 50.85 21.15Q720-509.7 720-480q0 29-20.5 50T650-408Zm-71-72ZM216-264q-29.7 0-50.85-21.17Q144-306.33 144-336.06v-288.22Q144-654 165.15-675T216-696h48l72 72H216v288h153l29.75-58.35Q411-417 432.5-430.5T480-444h36l180 180H591q-20 0-37.5-10.5T527-303l-30-58q-2.57-5.08-7.29-8.04Q485-372 480-372q-5 0-10 3t-7 8l-30 58q-9 18-26.5 28.5T369-264H216Z"></path>
      </g>
      <g id="code" viewBox="0 -960 960 960">
        <path d="M336-240 96-480l240-240 51 51-189 189 189 189-51 51Zm288 0-51-51 189-189-189-189 51-51 240 240-240 240Z"></path>
      </g>
      <g id="code-off" viewBox="0 -960 960 960">
        <path d="M768-90 288-570l-90 90 189 189-51 51L96-480l141-141L90-768l51-51 678 678-51 51Zm-45-249-51-51 90-90-189-189 51-51 240 240-141 141Z"></path>
      </g>
      <g id="content-paste" viewBox="0 -960 960 960">
        <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h171q8-31 33.5-51.5T480-888q34 0 59.5 20.5T573-816h171q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528h-72v120H288v-120h-72v528Zm263.79-528q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5Z"></path>
      </g>
      <g id="content-paste-off" viewBox="0 -960 960 960">
        <path d="m816-246-72-72v-426h-72v120H438L246-816h141q11-32 34.5-52t58.5-20q35 0 59 19.5t34 52.5h171q29.7 0 50.85 21.15Q816-773.7 816-744v498ZM479.79-744q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5ZM642-216 216-642v426h426Zm-426 72q-29.7 0-50.85-21.15Q144-186.3 144-216v-498l-54-54 51-51 678 678-51 51-54-54H216Z"></path>
      </g>
      <g id="cookie" viewBox="0 -960 960 960">
        <path d="M480-96q-79.38 0-149.19-30T208.5-208.5Q156-261 126-330.81T96-480q0-81 31-151.5t82.5-123Q261-807 329-837.5T470-868q23 0 45 3t45 9q-8 45 5.5 82t42.03 60.96q28.53 23.96 68 33T759-681q-24 57 8.01 108.5 32.01 51.49 95.08 53.4.95 10.49 1.43 19.55T864-480q0 78-30.24 147.98-30.24 69.99-82.08 122.6t-121.92 83.01Q559.68-96 480-96Zm-60-456q25 0 42.5-17.5T480-612q0-25-17.5-42.5T420-672q-25 0-42.5 17.5T360-612q0 25 17.5 42.5T420-552Zm-96 192q25 0 42.5-17.5T384-420q0-25-17.5-42.5T324-480q-25 0-42.5 17.5T264-420q0 25 17.5 42.5T324-360Zm275.79 36q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5ZM480-168q125 0 214.5-84.5T792-462q-45-18-75-55.5T679-603q-76-11-129-63t-63-126q-63-4-120.5 19.5t-102 66.5Q220-663 194-604.5T168-480q0 129.67 91.16 220.84Q350.33-168 480-168Zm0-311Z"></path>
      </g>
      <g id="credit-card" viewBox="0 -960 960 960">
        <path d="M864-696v432q0 29-21.15 50.5T792-192H168q-29 0-50.5-21.5T96-264v-432q0-29 21.5-50.5T168-768h624q29.7 0 50.85 21.5Q864-725 864-696Zm-696 72h624v-72H168v72Zm0 144v216h624v-216H168Zm0 216v-432 432Z"></path>
      </g>
      <g id="credit-card-off" viewBox="0 -960 960 960">
        <path d="m846-216-54-54v-210H582L438-624h354v-72H366l-72-72h498q29.7 0 50.85 21.15Q864-725.7 864-696v432q0 14-4 25.96-4 11.97-14 22.04ZM378-480Zm204 0Zm-204 0H168v216h426L378-480ZM803-56 666-192H168q-29.7 0-50.85-21.16Q96-234.32 96-264.04v-432.24Q96-726 116.86-747q20.85-21 50.14-21h25l78 78H168v66h66L56-803l51-50 746 746-50 51Z"></path>
      </g>
      <g id="database" viewBox="0 -960 960 960">
        <path d="M479.5-144q-140.5 0-238-41.85T144-288v-384q0-60 98-102t237.5-42q139.5 0 238 42T816-672v384q0 60.3-98 102.15Q620-144 479.5-144Zm.47-456Q566-600 646-621.5t98-50.5q-18-28-98.5-50t-165.53-22Q394-744 313.5-722T216-672q17 29 96.5 50.5T479.97-600Zm.03 192q42 0 80-4.5t71.5-12.5q33.5-8 62-20.5T744-474v-109q-24.25 13.22-53.62 23.61Q661-549 627.17-542.15q-33.83 6.85-71 10.5Q519-528 479.5-528t-77.11-3.65q-37.62-3.65-71-10.5Q298-549 268.5-559.5 239-570 216-583v109q22.41 15.94 50.21 28.47Q294-433 327.5-425q33.5 8 72 12.5T480-408Zm.32 192q43.32 0 88.05-6.4 44.73-6.39 82.4-16.9 37.67-10.5 63.09-23.75Q739.29-276.3 744-290v-101q-24.25 13.22-53.62 23.61Q661-357 627.17-350.15q-33.83 6.85-71 10.5Q519-336 479.5-336t-77.11-3.65q-37.62-3.65-71-10.5Q298-357 268.5-367.5 239-378 216-391v103q5 13 30.5 26t63 23q37.5 10 82.5 16.5t88.32 6.5Z"></path>
      </g>
      <g id="database-off" viewBox="0 -960 960 960">
        <path d="M449-449Zm97-87Zm-97 87Zm97-87Zm-97 87Zm97-87ZM768-90 90-768l51-51 678 678-51 51Zm-287.52-54Q339-144 241.5-185.85T144-288v-384q0-23 16-44.5t45-38.5l226 226q-65-4-120.5-18T216-583v109q44 32 111.5 49T480-408q17.96 0 35.02-.5 17.06-.5 34.12-2.5L612-348q-31 6-64.07 9-33.07 3-67.93 3-80 0-148.5-14.5T216-391v103q10 26 93.5 49T480-216q62 0 123-12t99-29l53 52q-45.91 28.22-117.59 44.61Q565.74-144 480.48-144ZM807-255l-63-63v-73q-11 6-23.94 11.33Q707.12-374.33 693-369l-57-57q32-8 59-20t49-28v-109q-40 22-94.5 35T532-530l-70-70q23 1 65-2.5t85.5-12q43.5-8.5 81-22.5t50.5-35q-18-28-98.5-50T480-744q-37 0-74 4.5T335-727l-59-59q43-14 94.5-22t109.5-8q139.07 0 237.53 42Q816-732 816-672v384q0 8-2 16.5t-7 16.5Z"></path>
      </g>
      <g id="developer-board" viewBox="0 -960 960 960">
        <path d="M168-144q-29 0-50.5-21.5T96-216v-528q0-29.7 21.5-50.85Q139-816 168-816h528q29 0 50.5 21.15T768-744v72h96v72h-96v84h96v72h-96v84h96v72h-96v71.5q0 29.5-21.5 51T696-144H168Zm0-72h528v-528H168v528Zm72-72h192v-144H240v144Zm240-288h144v-96H480v96Zm-240 96h192v-192H240v192Zm240 192h144v-240H480v240ZM168-744v528-528Z"></path>
      </g>
      <g id="developer-board-off" viewBox="0 -960 960 960">
        <path d="M803-56 56-803l51-50 746 746-50 51ZM246-816h449.54Q726-816 747-794.5t21 51v71.5h96v72h-96v84h96v72h-96v84h96v72h-90l-78-78v-378H318l-72-72Zm186 186-42-42h42v42Zm54 54-6-6v-90h144v96H486Zm138 138-90-90h90v90Zm-192 12Zm81-122ZM240-288v-144h192v144H240Zm-90-522 66 66h-48v528h529v-47l71 71q-9 19-29.5 33.5T696-144H168q-29 0-50.5-21.5T96-216v-528q0-22.66 16.5-40.33Q129-802 150-810Zm330 330 160 160v32H480v-192ZM288-672l158 158v34H240v-192h48Z"></path>
      </g>
      <g id="devices-off" viewBox="0 -960 960 960">
        <path d="m366-696-72-72h522v72H366Zm498 480-72-72v-264H648v138l-72-72v-102q0-15.3 10.34-25.65Q596.68-624 611.96-624h215.76q15.28 0 25.78 10.35Q864-603.3 864-588v372ZM768-90 666-192h-54q-15.3 0-25.65-10.35Q576-212.7 576-228v-54L264-594v306h216v96H96v-96h96v-378L90-768l51-51 678 678-51 51Zm-48-261Z"></path>
      </g>
      <g id="drive-pdf" viewBox="0 -960 960 960">
        <path d="M612-384h48v-64h48v-48h-48v-32h48v-48h-96v192Zm-360 0h48v-64h36q20.4 0 34.2-13.8Q384-475.6 384-496v-32q0-20.4-13.8-34.2Q356.4-576 336-576h-84v192Zm48-112v-32h36v32h-36Zm132 112h84q20.4 0 34.2-13.8Q564-411.6 564-432v-96q0-20.4-13.8-34.2Q536.4-576 516-576h-84v192Zm48-48v-96h36v96h-36ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h528v-528H216v528Zm0-528v528-528Z"></path>
      </g>
      <g id="file-download-off" viewBox="0 -960 960 960">
        <path d="M768-90 666-192H264.09q-29.74 0-50.91-21.15Q192-234.3 192-264v-72h72v72h330l-93-93-21 21-192-192 21-21L90-768l51-51 678 678-51 51ZM603-459l-51-51 69-69 51 51-69 69Zm-87-87-72-72v-198h72v270Zm252 252-42-42h42v42Z"></path>
      </g>
      <g id="file-save" viewBox="0 -960 960 960">
        <path d="m732-120 144-144-51-51-57 57v-150h-72v150l-57-57-51 51 144 144ZM588 0v-72h288V0H588ZM264-144q-29 0-50.5-21.5T192-216v-576q0-29 21.5-50.5T264-864h312l192 192v192h-72v-144H528v-168H264v576h264v72H264Zm0-72v-576 576Z"></path>
      </g>
      <g id="file-save-off" viewBox="0 -960 960 960">
        <path d="m837-225-51-51 39-39 51 51-39 39Zm-69-69-72-71.81V-408h72v114ZM588 0v-72h198L264-594v378h265v72H264q-29 0-50.5-21.5T192-216v-450L56-803l51-50L888-72V0H588Zm108-480h72v-192L576-864H264q-13 0-26.5 5T216-846l54 54h258v168h168v144Zm-242 76Zm96-118Z"></path>
      </g>
      <g id="font-download" viewBox="0 -960 960 960">
        <path d="M257-240h83.34L384-363h193l43.31 123H703L523-720h-86L257-240Zm151-192 70-199h3l70 199H408ZM168-96q-29.7 0-50.85-21.15Q96-138.3 96-168v-624q0-29.7 21.15-50.85Q138.3-864 168-864h624q29.7 0 50.85 21.15Q864-821.7 864-792v624q0 29.7-21.15 50.85Q821.7-96 792-96H168Zm0-72h624v-624H168v624Zm0-624v624-624Z"></path>
      </g>
      <g id="font-download-off" viewBox="0 -960 960 960">
        <path d="m803-56-41-40H168q-29.7 0-50.85-21.15Q96-138.3 96-168v-594l-40-41 51-50 746 746-50 51ZM168-168h522L168-690v522Zm696-30-72-72v-522H270l-72-72h594q29.7 0 50.85 21.15Q864-821.7 864-792v594ZM632-430 509-553l-27-78h-4l-12 35-55-55 26-69h86l109 290Zm-205 2Zm82-124Zm105 301-51-146 130 130 6 16h-85Zm-358 11 127-337 57 57-31 88h119.1l68.9 69H386.98L344-240h-88Z"></path>
      </g>
      <g id="hand-gesture" viewBox="0 -960 960 960">
        <path d="M880-759q0-51-35-86t-86-35v-60q75 0 128 53t53 128h-60ZM240-40q-83 0-141.5-58.5T40-240h60q0 58 41 99t99 41v60Zm162 0q-30 0-56-13.5T303-92L48-465l24-23q19-19 45-22t47 12l116 81v-383q0-17 11.5-28.5T320-840q17 0 28.5 11.5T360-800v537L212-367l157 229q5 8 14 13t19 5h278q33 0 56.5-23.5T760-200v-560q0-17 11.5-28.5T800-800q17 0 28.5 11.5T840-760v560q0 66-47 113T680-40H402Zm38-440v-400q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v400h-80Zm160 0v-360q0-17 11.5-28.5T640-880q17 0 28.5 11.5T680-840v360h-80ZM486-300Z"></path>
      </g>
      <g id="hand-gesture-off" viewBox="0 -960 960 960">
        <path d="m840-234-80-80v-446q0-17 11.5-28.5T800-800q17 0 28.5 11.5T840-760v526ZM360-714l-80-80v-6q0-17 11.5-28.5T320-840q17 0 28.5 11.5T360-800v86Zm160 160-80-80v-246q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v326Zm160 75h-80v-361q0-17 11.5-28.5T640-880q17 0 28.5 11.5T680-840v361Zm37 349L360-487v252l-158-79 177 176q8 7 16 12.5t18 5.5h267q10 0 19.5-2.5T717-130ZM413-40q-24 0-46-9t-39-26L39-364l54-43q18-14 41-16.5t44 8.5l102 50v-202L27-820l57-57L876-85l-57 57-44-44q-20 15-44 23.5T680-40H413Zm187-439Zm280-280q0-51-35-86t-86-35v-60q75 0 128 53t53 128h-60ZM240-40q-83 0-141.5-58.5T40-240h60q0 58 41 99t99 41v60Zm304-264Z"></path>
      </g>
      <g id="hide-image" viewBox="0 -960 960 960">
        <path d="m816-246-72-72v-426H318l-72-72h498q29 0 50.5 21.5T816-744v498ZM768-90l-54-54H216q-29 0-50.5-21.5T144-216v-498l-54-54 51-51 678 678-51 51ZM264-288l108-144 72 96 34-45-262-261v426h426l-72-72H264Zm264-240ZM426-426Z"></path>
      </g>
      <g id="imagesmode" viewBox="0 -960 960 960">
        <path d="M216-144q-29.7 0-50.85-21.5Q144-187 144-216v-528q0-29 21.15-50.5T216-816h528q29.7 0 50.85 21.5Q816-773 816-744v528q0 29-21.15 50.5T744-144H216Zm0-72h528v-528H216v528Zm48-72h432L552-480 444-336l-72-96-108 144Zm-48 72v-528 528Zm120-360q20 0 34-14t14-34q0-20-14-34t-34-14q-20 0-34 14t-14 34q0 20 14 34t34 14Z"></path>
      </g>
      <g id="location-off" viewBox="0 -960 960 960">
        <path d="M480.28-96q-13.71 0-23.49-7.5Q447-111 443-123q-19-53-45.5-100.5T321-335q-49.21-63.41-79.61-121.06Q211-513.71 211-595.37q0-33.63 8-64.63 8-31 22-59l55 54q-6 17-9.5 34t-3.5 36q0 69.29 27 115.64Q337-433 378-379q42 55.45 63.5 88.73Q463-257 480-223q17-34 38.5-67.27Q540-323.55 582-379l51 52q-49 64-74 109t-42 95q-5 12-14.5 19.5T480.28-96ZM677-386l-52-52q23-35 37.5-71.3T677-595q0-81-58-139t-139-58q-44 0-81 17.5T335-728l-52-51q37.06-39.53 87.77-62.27Q421.49-864 480-864q112.4 0 190.7 78.3Q749-707.4 749-595q0 67.39-20.5 116.22T677-386Zm91 296L90-769l51-51 678 679-51 51ZM542-521q15.91-13.73 25.45-32.37Q577-572 577-595q0-40-28.5-68.5T480-692q-23 0-41.63 9.55Q419.73-672.91 406-657l136 136Zm-68-68Zm-63 141Z"></path>
      </g>
      <g id="lock" viewBox="0 -960 960 960">
        <path d="M266.59-88.59q-34.26 0-58.49-24.38-24.23-24.38-24.23-58.62v-378.26q0-34.24 24.38-58.62 24.38-24.38 58.62-24.38h17.54v-89.06q0-81.6 57.19-138.95 57.18-57.36 138.63-57.36 81.44 0 138.4 57.36 56.96 57.35 56.96 138.95v89.06h17.54q34.24 0 58.62 24.38 24.38 24.38 24.38 58.62v378.26q0 34.24-24.39 58.62-24.4 24.38-58.65 24.38h-426.5Zm.28-83h426.26v-378.26H266.87v378.26Zm213.34-117.13q29.79 0 50.79-21.21t21-51q0-29.79-21.21-50.79t-51-21q-29.79 0-50.79 21.21-21 21.22-21 51 0 29.79 21.21 50.79t51 21Zm-112.8-344.13h225.18v-89.06q0-47.21-32.73-80.26-32.73-33.05-79.86-33.05t-79.86 33.05q-32.73 33.05-32.73 80.26v89.06ZM266.87-171.59v-378.26 378.26Z"></path>
      </g>
      <g id="mic" viewBox="0 -960 960 960">
        <path d="M480-384q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm0-240Zm-36 480v-99q-98.8-13.1-163.4-87.05Q216-404 216-504h72q0 79.68 56.23 135.84 56.22 56.16 136 56.16Q560-312 616-368.16q56-56.16 56-135.84h72q0 100-64.6 173.95Q614.8-256.1 516-243v99h-72Zm36-312q20.4 0 34.2-13.8Q528-483.6 528-504v-240q0-20.4-13.8-34.2Q500.4-792 480-792q-20.4 0-34.2 13.8Q432-764.4 432-744v240q0 20.4 13.8 34.2Q459.6-456 480-456Z"></path>
      </g>
      <g id="mic-off" viewBox="0 -960 960 960">
        <path d="m701-361-53-53q11-21 17.33-43.4 6.33-22.41 6.33-46.6H744q0 38-11.18 74.38Q721.64-393.24 701-361ZM477-583Zm117.24 115L528-534v-210q0-20.4-13.8-34.2Q500.4-792 480-792q-20.4 0-34.2 13.8Q432-764.4 432-744v114l-72-72.38V-744q0-50 35-85t85-35q50 0 85 35t35 85v240q0 9-1.5 18t-4.26 18ZM444-144v-99q-99-12-163.5-86.5T216-504h72q0 79.68 56 135.84T480-312q34 0 64.5-13t56.5-35l52 52q-29.3 25.09-64.15 42.55Q554-248 516-243v99h-72Zm324 54L90-769l51-51 678 679-51 51Z"></path>
      </g>
      <g id="notifications" viewBox="0 -960 960 960">
        <path d="M192-216v-72h48v-240q0-87 53.5-153T432-763v-53q0-20 14-34t34-14q20 0 34 14t14 34v53q85 16 138.5 82T720-528v240h48v72H192Zm288-276Zm-.21 396Q450-96 429-117.15T408-168h144q0 30-21.21 51t-51 21ZM312-288h336v-240q0-70-49-119t-119-49q-70 0-119 49t-49 119v240Z"></path>
      </g>
      <g id="notifications-off" viewBox="0 -960 960 960">
        <path d="M192-216v-72h48v-240q0-41 13.5-78.5T290-677l53 53q-15 21-23 45.75T312-528v240h264L90-774l51-52 678 679-51 51-120-120H192Zm528-132-72-72v-108q0-70-49-119t-119-49q-22.84 0-43.92 6Q415-684 395-673l-52-52.51Q363-740 385.5-749q22.5-9 46.5-14v-53q0-20 14-34t34-14q20 0 34 14t14 34v53q85 16 138.5 82T720-528v180Zm-276-72Zm35.79 324Q450-96 429-117.15T408-168h144q0 30-21.21 51t-51 21ZM522-547Z"></path>
      </g>
      <g id="open-in-browser" viewBox="0 -960 960 960">
        <path d="M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H576v-72h168v-456H216v456h168v72H216Zm228 0v-246l-57 57-51-51 144-144 144 144-51 51-57-57v246h-72Z"></path>
      </g>
      <g id="open-in-new-off" viewBox="0 -960 960 960">
        <path d="m768-90-54-54H216q-29.7 0-50.85-21.15Q144-186.3 144-216v-498l-54-54 51-51 678 678-51 51ZM216-216h426L455-404l-68 68-51-51 68-68-188-187v426Zm102-528-72-72h234v72H318Zm238 239-51-51 188-188H576v-72h240v240h-72v-117L556-505Zm260 259-72-72v-162h72v234Z"></path>
      </g>
      <g id="page-info" viewBox="0 -960 960 960">
        <path d="M699.83-133.48q-62.16 0-105.23-43.07-43.08-43.08-43.08-105.23 0-62.16 43.08-105.23 43.07-43.08 105.23-43.08 62.15 0 105.23 43.08 43.07 43.07 43.07 105.23 0 62.15-43.07 105.23-43.08 43.07-105.23 43.07Zm.12-80.61q28.09 0 47.83-19.86t19.74-47.95q0-28.1-19.86-47.84-19.86-19.74-47.96-19.74-28.09 0-47.83 19.86t-19.74 47.96q0 28.09 19.86 47.83t47.96 19.74ZM150.3-240.28v-83h329.22v83H150.3Zm109.87-289.63q-62.15 0-105.23-43.08-43.07-43.07-43.07-105.23 0-62.15 43.07-105.23 43.08-43.07 105.23-43.07 62.16 0 105.23 43.07 43.08 43.08 43.08 105.23 0 62.16-43.08 105.23-43.07 43.08-105.23 43.08Zm.13-80.61q28.09 0 47.83-19.86t19.74-47.96q0-28.09-19.86-47.83t-47.96-19.74q-28.09 0-47.83 19.86t-19.74 47.95q0 28.1 19.86 47.84 19.86 19.74 47.96 19.74Zm220.18-26.2v-83H809.7v83H480.48Zm219.35 354.94ZM260.17-678.22Z"></path>
      </g>
      <g id="piano" viewBox="0 -960 960 960">
        <path d="M216-144q-29 0-50.5-21.5T144-216v-528q0-29.7 21.5-50.85Q187-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29-21.15 50.5T744-144H216Zm0-72h120v-168h-24q-10.2 0-17.1-6.9-6.9-6.9-6.9-17.1v-336h-72v528Zm408 0h120v-528h-72v336q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9h-24v168Zm-240 0h192v-168h-24q-10.2 0-17.1-6.9-6.9-6.9-6.9-17.1v-336h-96v336q0 10.2-6.9 17.1-6.9 6.9-17.1 6.9h-24v168Z"></path>
      </g>
      <g id="piano-off" viewBox="0 -960 960 960">
        <path d="m768-90-54-54H216q-29.7 0-50.85-21.15Q144-186.3 144-216v-498l-54-54 51-51 678 678-51 51Zm48-156-72-72v-426h-72v336q0 3.67-1.5 7.33Q669-397 667-395L528-534v-210h-96v114L246-816h498q29.7 0 50.85 21.15Q816-773.7 816-744v498Zm-600 30h120v-168h-24q-10.2 0-17.1-6.9-6.9-6.9-6.9-17.1v-162l-72-72v426Zm168 0h192v-66L432-426v18q0 10-7 17t-17 7h-24v168Zm240-2h9l-9-9v9Z"></path>
      </g>
      <g id="protocol-handler" viewBox="0 -960 960 960">
        <path d="M378-173q-10 0-19-4t-17-12L108-448q-6-7-9-15.5T96-480q0-9 3-17t9-15l234-259q8-8 17-12t19-4q10 0 18.5 4t16.5 12l67 74 67-74q8-8 16.5-12t18.5-4q10 0 19 4t17 12l234 259q6 7 9 15.5t3 16.5q0 8-3 16.5t-9 15.5L618-189q-8 8-17 12t-19 4q-10 0-18.5-4T547-189l-67-74-67 74q-8 8-16.5 12t-18.5 4Zm0-84 54-59-120-132q-12-14-12-32t12-32l120-132-54-59-202 223 202 223Zm204 0 202-223-202-223-54 59 120 132q12 14 12 32t-12 32L528-316l54 59Z"></path>
      </g>
      <g id="protocol-handler-off" viewBox="0 -960 960 960">
        <path d="M768-90 642-216l-24 27q-7 8-16 12t-20 4q-11 0-20-4t-15-12l-67-74-67 74q-7 8-16 12t-19 4q-11 0-20-4t-16-12L108-448q-6-6-9-14.5T96-480q0-9 3-17t9-15l113-125L90-768l51-51 678 678-51 51ZM591-267l-56-57 56 57Zm-213 10 54-59-120-132q-12-14-12-32t12-32l16-18-56-56-96 106 202 223Zm361-66-51-51 96-106-209-216-47 52 120 132q12 14 12 32t-12 32l-16 18-208-208-55-55-51-51 24-27q8-8 16.5-12t19.5-4q10 0 19 4t16 12l67 74 67-74q7-8 16-12t19-4q11 0 20 4t16 12l234 259q6 7 9 15t3 17q0 9-3 17t-9 15L739-323Z"></path>
      </g>
      <g id="select-window" viewBox="0 -960 960 960">
        <path d="M168-96q-29.7 0-50.85-21.15Q96-138.3 96-168v-336q0-29.7 21.15-50.85Q138.3-576 168-576h72v-216q0-29.7 21.15-50.85Q282.3-864 312-864h480q29.7 0 50.85 21.15Q864-821.7 864-792v336q0 29.7-21.15 50.85Q821.7-384 792-384h-72v216q0 29.7-21.15 50.85Q677.7-96 648-96H168Zm0-72h480v-264H168v264Zm552-288h72v-264H312v144h336q29.7 0 50.85 21.15Q720-533.7 720-504v48Z"></path>
      </g>
      <g id="select-window-off" viewBox="0 -960 960 960">
        <path d="M803-56 427-432H168v264h480v-144l72 71.75v72.65q0 29.6-21.15 50.6T648-96H168q-29.7 0-50.85-21.15Q96-138.3 96-168v-336.18q0-30.82 21-52.32t51-19.5h72v-42L56-803l51-50 746 746-50 51Zm-83-286-98-98-136-136h162q31 0 51.5 20.5T720-504v48h72v-264H342l-97-97q7-22 25.64-34.5Q289.27-864 312-864h480q29.7 0 50.85 21.15Q864-821.7 864-792v336q0 29.7-21.15 50.85Q821.7-384 792-384h-72v42Z"></path>
      </g>
      <g id="sensors" viewBox="0 -960 960 960">
        <path d="M209-209q-53-52-83-121.48T96-479.5q0-80.5 30-150T208-752l51 51q-42 43-66.5 99.6Q168-544.8 168-480.39q0 65.39 24.47 121.93Q216.94-301.92 260-260l-51 51Zm101-101q-32-33-51-76.5t-19-93.23q0-50.73 19-94T310-650l51 51q-22.94 23.21-35.97 53.79Q312-514.62 312-479.81t13.03 65.26Q338.06-384.1 361-361l-51 51Zm169.75-86q-34.75 0-59.25-24.75t-24.5-59.5q0-34.75 24.75-59.25t59.5-24.5q34.75 0 59.25 24.75t24.5 59.5q0 34.75-24.75 59.25t-59.5 24.5ZM649-311l-50-50q22.94-23.21 35.97-53.79Q648-445.38 648-480.19t-13.03-65.26Q621.94-575.9 599-599l51-51q32 33 51 76.34t19 94.16q0 49.82-19 93.16Q682-343 649-311Zm102 102-51-51q43-42 67.5-98.6Q792-415.2 792-479.61q0-65.39-24.5-121.89T701-701l51-51q52 53 82 122.48t30 149.98q0 79.54-30 149.04Q804-261 751-209Z"></path>
      </g>
      <g id="sensors-off" viewBox="0 -960 960 960">
        <path d="M768-90 322-536q-5 13-7.5 27t-2.5 29q0 35 13 65.5t36 53.5l-50 50q-33-32-52-75.5T240-480q0-30 7.5-57.5T268-590l-53-54q-22 36-34.5 77.5T168-480q0 65 24.5 121.5T260-260l-51 51q-53-52-83-121.5T96-480q0-60 17-114.5T162-696l-72-72 51-51 678 678-51 51Zm30-174-53-52q22-36 34.5-77.5T792-480q0-65-24.5-121.5T700-700l51-51q53 52 83 121.5T864-480q0 60-17 115t-49 101ZM693-369l-55-55q5-14 7.5-27.5T648-480q0-35-13-65.5T599-599l50-50q33 32 52 75.5t19 93.5q0 30-6.5 58T693-369Z"></path>
      </g>
      <g id="smart-card-reader" viewBox="0 -960 960 960">
        <path d="M80-80v-120q0-33 23.5-56.5T160-280h640q33 0 56.5 23.5T880-200v120H80Zm80-80h640v-40H160v40Zm40-180v-460q0-33 23.5-56.5T280-880h400q33 0 56.5 23.5T760-800v460h-80v-460H280v460h-80Zm120-60h23q44 0 70.5-44T440-560q0-72-26.5-116T343-720h-23v320Zm240-80q33 0 56.5-23.5T640-560q0-33-23.5-56.5T560-640q-33 0-56.5 23.5T480-560q0 33 23.5 56.5T560-480Zm-80 320Zm0-410Z"></path>
      </g>
      <g id="smart-card-reader-off" viewBox="0 -960 960 960">
        <path d="M680-932q33 0 56.5 23.5T760-852v460h-28l-52-52v-408H273l-53-53q11-13 26.5-20t33.5-7h400Zm-91 396L485-639q9-23 29-38t46-15q33 0 56.5 23.5T640-612q0 26-14 46.5T589-536Zm-269 86v-242l118 118q-7 57-32 90.5T343-450h-23ZM160-212h527l-40-40H160v40ZM819-80l-52-52H80v-120q0-33 23.5-56.5T160-332h407L280-620v228h-80v-308L28-872l56-56 792 791-57 57ZM424-212Zm52-436Zm-82 142Z"></path>
      </g>
      <g id="storage-access" viewBox="0 -960 960 960">
        <path d="M312-255q-97-32-156.5-113.5T96-552q0-130 91-221t221-91q102 0 183.5 59.5T705-648h-77q-29-66-88.5-105T408-792q-100 0-170 70t-70 170q0 72 39 131t105 88v78ZM456-96q-29.7 0-50.85-21.15Q384-138.3 384-168v-336q0-29.7 21.15-50.85Q426.3-576 456-576h336q29.7 0 50.85 21.15Q864-533.7 864-504v336q0 29.7-21.15 50.85Q821.7-96 792-96H456Zm0-72h336v-336H456v336Zm24-48h288l-91-120-72 95-53-71-72 96Zm144-120ZM398-563Z"></path>
      </g>
      <g id="storage-access-off" viewBox="0 -960 960 960">
        <path d="m864-198-72-72v-234H558l-72-72h306q29.7 0 50.85 21.15Q864-533.7 864-504v306ZM628-648q-29-66-88.5-105T408-792q-28.71 0-56.35 7Q324-778 298-764l-54-53q38-23 79.33-35T408-864q102 0 183.5 59.5T705-648h-77Zm-55 363ZM803-55l-41-41H456q-29.7 0-50.85-21.15Q384-138.3 384-168v-306L195-663q-13 25-20 52.95-7 27.95-7 58.05 0 72 39 131t105 88v78q-97-32-156.5-113.5T96-552q0-45.35 12-86.68Q120-680 142-716l-86-86 51-51 747 747-51 51ZM434-646Zm-77 43Zm123 387 71-96 61 62 42-56 90 90H480Zm-24 48h234L456-402v234Zm219-219Z"></path>
      </g>
      <g id="sync-off" viewBox="0 -960 960 960">
        <path d="M768-141 625-284q-17 10-35 18.5T552-252v-76q5-2 10-4.5t10-4.5L286-624q-10 21-16 44.5t-6 48.5q0 48 19.5 89t52.5 70v-63h72v192H216v-72h74q-45-40-71.5-95.5T192-531q0-40 10.5-77t29.5-69L90-820l51-51 678 679-51 51Zm-40-244-54-54q10-21 16-44t6-48q0-48-19.5-89.5T624-691v64h-72v-192h192v72h-74q45 40 71.5 95.5T768-531q0 40-10.5 77T728-385ZM388-725l-53-54q17-10 35-18t38-13v76q-5 2-10 4.5t-10 4.5Z"></path>
      </g>
      <g id="sync-saved-locally" viewBox="0 -960 960 960">
        <path d="m437-402 221-221-55-54-166 166-81-81-55 54 136 136ZM48-144v-72h864v72H48Zm120-120q-29.7 0-50.85-21.15Q96-306.3 96-336v-408q0-29.7 21.15-50.85Q138.3-816 168-816h624q29.7 0 50.85 21.15Q864-773.7 864-744v408q0 29.7-21.15 50.85Q821.7-264 792-264H168Zm0-72h624v-408H168v408Zm0 0v-408 408Z"></path>
      </g>
      <g id="sync-saved-locally-off" viewBox="0 -960 960 960">
        <path d="m797-264-71-72h66v-408H318l-72-72h546q29.7 0 50.85 21.15Q864-773.7 864-744v408q0 27.6-19 48.3-19 20.7-48 23.7Zm6 208-89.05-88H48v-72h594l-48-48H168q-29.7 0-50.85-21.15Q96-306.3 96-336v-408q0-4 .5-8t1.5-8l-42-42 51-51 746 747-50 50ZM522-336 168-690v354h354Zm0-204Zm-177 27Zm149-55 109-109 55 54-109 109-55-54Z"></path>
      </g>
      <g id="usb" viewBox="0 -960 960 960">
        <path d="M479.79-96Q450-96 429-117.15T408-168q0-19.53 9.5-36.26Q427-221 444-230v-106H324q-29.7 0-50.85-21.04Q252-378.08 252-407.63V-490q-17-9-26.5-25.5T216-552q0-29.7 21.21-50.85 21.21-21.15 51-21.15T339-602.85q21 21.15 21 50.85 0 20-9.5 36.5T324-490v82h120v-312h-84l120-144 120 144h-84v312h120v-72h-36v-144h144v144h-36v72q0 29.7-21.15 50.85Q665.7-336 636-336H516v106q17.1 9.11 26.55 25.5 9.45 16.4 9.45 36.44Q552-138 530.79-117q-21.21 21-51 21Z"></path>
      </g>
      <g id="usb-off" viewBox="0 -960 960 960">
        <path d="M768-90 521.58-336H516v106q17.1 8.94 26.55 25.47T552-168q0 29.7-21.21 50.85Q509.58-96 479.79-96T429-117.15Q408-138.3 408-168q0-20 9.5-36t26.5-26v-106H324q-29.7 0-50.85-21.04Q252-378.08 252-407.63V-490q-17-8-26.5-25.22Q216-532.45 216-552q0-17 8.5-32.5T247-611L90-768l51-51 678 678-51 51Zm-73-277-59-59v-54h-36v-144h144v144h-36v72q0 11.08-2.89 21.61T695-367Zm-371-41h120v-6l-97-97q-5 7-10.5 11.5T324-490v82Zm192-138-72-72v-102h-84l120-144 120 144h-84v174Z"></path>
      </g>
      <g id="v8" viewBox="0 -960 960 960">
        <path d="M480-242q-82 0-140.5-58.5T281-441q0-37.71 14-72.36Q309-548 335-575q-9-18-14-36.56-5-18.56-5-38.42 0-68.2 48.21-116.11Q412.41-814 480-814q68.19 0 116.09 47.94Q644-718.11 644-649.87q0 19.87-5 38.87-5 19-14 36 26 27 40 61.64 14 34.65 14 72.36 0 82-58.5 140.5T480-242Zm-.05-48Q543-290 587-333.97T631-441q0-32-13.5-61T579-553l-16-14 12-18q10-14 15.5-30.5T596-650q0-48.18-33.87-82.09-33.87-33.91-82-33.91T398-732.09q-34 33.91-34 82.09 0 17 5.5 33.5T385-585l11 18-15 14q-25 22-38.5 51T329-441q0 63.06 43.95 107.03 43.96 43.97 107 43.97ZM248-523l-50-91h-52L72-744h219q-11 21-17 44.5t-6 49.5q0 16.67 3 33.33 3 16.67 8 33.67-10 14-17.5 29T248-523ZM480-96l-57-106q13.94 3.2 27.87 5.6 13.94 2.4 29.03 2.4 15.1 0 29.1-2.4 14-2.4 28-5.6L480-96Zm232-427q-6.3-15.74-13.65-30.87Q691-569 681-583q5-17 8-33.67 3-16.66 3-33.33 0-26-6-49.5T669-744h219l-74 130h-52l-50 91Zm-232-77q20 0 34-14t14-34q0-20-14-34t-34-14q-20 0-34 14t-14 34q0 20 14 34t34 14Zm.1 228q24.9 0 42.4-17.57T540-432q0-25-17.5-42.5T480-492q-24.86 0-42.43 17.6T420-431.9q0 24.9 17.6 42.4t42.5 17.5Zm-.1-156Z"></path>
      </g>
      <g id="videocam-off" viewBox="0 -960 960 960">
        <path d="M864-289 720-433v90l-72-72v-281H366l-72-72h354q29.7 0 50.85 21.15Q720-725.7 720-696v167l144-144v384ZM803-57 56-803l51-51 747 746-51 51ZM507-556ZM406-455ZM194-766l70 69h-48v433h432v-50l72 72q-8 20-25 35t-46.72 15H216q-29 0-50.5-21.19T144-264.14V-697q0-25.58 14.5-43.79T194-766Z"></path>
      </g>
      <g id="videogame-asset" viewBox="0 -960 960 960">
        <path d="M168-240q-29.7 0-50.85-21.5Q96-283 96-312v-336q0-29 21.15-50.5T168-720h624q29.7 0 50.85 21.5Q864-677 864-648v336q0 29-21.15 50.5T792-240H168Zm0-72h624v-336H168v336Zm122-48h72v-84h84v-72h-84v-84h-72v84h-84v72h84v84Zm286-12q25 0 42.5-17.5T636-432q0-25-17.5-42.5T576-492q-25 0-42.5 17.5T516-432q0 25 17.5 42.5T576-372Zm120-96q25 0 42.5-17.5T756-528q0-25-17.5-42.5T696-588q-25 0-42.5 17.5T636-528q0 25 17.5 42.5T696-468ZM168-312v-336 336Z"></path>
      </g>
      <g id="videogame-asset-off" viewBox="0 -960 960 960">
        <path d="M696-468q-25 0-42.5-17.5T636-528q0-25 17.5-42.5T696-588q25 0 42.5 17.5T756-528q0 25-17.5 42.5T696-468Zm-319-8Zm-89 116v-84h-84v-72h84v-84h72v84h84v72h-84v84h-72ZM168-240q-29 0-50.5-21.5T96-312v-336q0-29 20.2-50.5Q136.39-720 165-720h75l72 72H168v336h378L90-768l51-51 678 678-51 51-150-150H168Zm696-72q0 23.24-12 41.12T817-245l-25-25v-378H414l-72-72h450q29 0 50.5 21.5T864-648v336ZM603-459Z"></path>
      </g>
      <g id="volume-up" viewBox="0 -960 960 960">
        <path d="M552-152v-75q86-23 139-93.26 53-70.25 53-159.5 0-89.24-53.5-158.74Q637-708 552-734v-75q116 25 190 117t74 211q0 119-73.5 211.5T552-152ZM144-385v-192h144l192-192v576L288-385H144Zm408 55v-302q45.12 20.4 70.56 61.2Q648-530 648-480.52q0 48.52-25.44 89.23Q597.12-350.59 552-330ZM408-595l-90 90H216v48h102l90 90v-228Zm-91 113Z"></path>
      </g>
      <g id="volume-off" viewBox="0 -960 960 960">
        <path d="M768-90 661-197q-22 14-52.5 26.5T552-152v-74q12-5 28.5-11.5T608-250L480-378v187L288-383H144v-192h138L90-768l51-51 678 678-51 51Zm-6-209-52-52q16-29 25-61.5t9-66.5q0-89-53.5-158.5T552-733v-74q117 23 190.5 116T816-479q0 48-14 93.5T762-299ZM638-423l-86-86v-122q45 20 70.5 61.5T648-479q0 14-2 28t-8 28ZM480-581l-93-93 93-93v186Zm-72 216v-85l-72-72-18 19H216v48h102l90 90Zm-36-121Z"></path>
      </g>
      <g id="warning" viewBox="0 -960 960 960">
        <path d="m48-144 432-720 432 720H48Zm127-72h610L480-724 175-216Zm304.79-48q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5ZM444-384h72v-192h-72v192Zm36-86Z"></path>
      </g>
      <g id="web-asset" viewBox="0 -960 960 960">
        <path d="M168-192q-29.7 0-50.85-21.16Q96-234.32 96-264.04v-432.24Q96-726 117.15-747T168-768h624q29.7 0 50.85 21.16Q864-725.68 864-695.96v432.24Q864-234 842.85-213T792-192H168Zm0-72h624v-360H168v360Z"></path>
      </g>
      <g id="web-asset-off" viewBox="0 -960 960 960">
        <path d="M803-56 666-192H168q-29.7 0-50.85-21.16Q96-234.32 96-264.04v-432.24Q96-726 118.03-747T171-768h11v91L56-803l51-50 746 746-50 51ZM168-264h426L234-624h-66v360Zm678 48-54-54v-354H438L294-768h498q29.7 0 50.85 21.15Q864-725.7 864-696v432q0 13.79-5 26.9-5 13.1-13 21.1Z"></path>
      </g>
      <g id="zoom-in" viewBox="0 -960 960 960">
        <path d="M765-144 526-384q-30 23-65.79 35.5-35.79 12.5-76.18 12.5Q284-336 214-406t-70-170q0-100 70-170t170-70q100 0 170 70t70 170.03q0 40.39-12.5 76.18Q599-464 577-434l239 239-51 51ZM384-408q70 0 119-49t49-119q0-70-49-119t-119-49q-70 0-119 49t-49 119q0 70 49 119t119 49Zm-36-60v-72h-72v-72h72v-72h72v72h72v72h-72v72h-72Z"></path>
      </g>
    </defs>
  </svg>
</cr-iconset>
`;
var iconsets = div.querySelectorAll("cr-iconset");
for (const iconset of iconsets) document.head.appendChild(iconset);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_sandbox/privacy_sandbox_browser_proxy.js
var PrivacySandboxBrowserProxyImpl = class PrivacySandboxBrowserProxyImpl {
	getFledgeState() {
		return sendWithPromise("getFledgeState");
	}
	setFledgeJoiningAllowed(site, allowed) {
		chrome.send("setFledgeJoiningAllowed", [site, allowed]);
	}
	getTopicsState() {
		return sendWithPromise("getTopicsState");
	}
	setTopicAllowed(topic, allowed) {
		chrome.send("setTopicAllowed", [
			topic.topicId,
			topic.taxonomyVersion,
			allowed
		]);
	}
	topicsToggleChanged(newToggleValue) {
		chrome.send("topicsToggleChanged", [newToggleValue]);
	}
	getFirstLevelTopics() {
		return sendWithPromise("getFirstLevelTopics");
	}
	getChildTopicsCurrentlyAssigned(topic) {
		return sendWithPromise("getChildTopicsCurrentlyAssigned", topic.topicId, topic.taxonomyVersion);
	}
	shouldShowPrivacySandboxAdTopicsContentParity() {
		return sendWithPromise("shouldShowPrivacySandboxAdTopicsContentParity");
	}
	static getInstance() {
		return instance$11 || (instance$11 = new PrivacySandboxBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$11 = obj;
	}
};
var instance$11 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_ad_topics_fragment.html.js
function getTemplate$13() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared"></style>
<div class="settings-fragment-header" focus-element tabindex="-1">
  <picture>
    <source
        srcset="./images/privacy_guide/ad_topics_graphic_dark.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/ad_topics_graphic.svg">
  </picture>
  <h2 class="settings-fragment-header-label">
    $i18n{privacyGuideAdTopicsHeading}
  </h2>
</div>
<div class="fragment-content">
  <div class="embedded-setting-wrapper">
    <settings-toggle-button id="adTopicsToggle"
        pref="{{prefs.privacy_sandbox.m1.topics_enabled}}"
        on-settings-boolean-control-change="onToggleChange_"
        label="$i18n{privacyGuideAdTopicsToggleLabel}">
    </settings-toggle-button>
  </div>
  <div class="settings-columned-section">
    <div class="column">
      <h3 class="description-header">$i18n{columnHeadingWhenOn}</h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:history" aria-hidden="true"></cr-icon>
          <div class="secondary">$i18n{privacyGuideAdTopicsWhenOnBullet1}</div>
        </li>
        <li>
          <cr-icon icon="settings20:security" aria-hidden="true"></cr-icon>
          <div class="secondary">$i18n{privacyGuideAdTopicsWhenOnBullet2}</div>
        </li>
        <li>
          <cr-icon icon="settings20:auto-delete" aria-hidden="true"></cr-icon>
          <div class="secondary">$i18n{privacyGuideAdTopicsWhenOnBullet3}</div>
        </li>
      </ul>
    </div>
    <div class="column">
      <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:rule-folder" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideAdTopicsThingsToConsiderBullet1}
          </div>
        </li>
        <li>
          <cr-icon icon="settings20:web" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideAdTopicsThingsToConsiderBullet2}
          </div>
        </li>
        <li>
          <cr-icon icon="settings20:gavel" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18nRaw{privacyGuideAdTopicsThingsToConsiderBullet3Desktop}
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_ad_topics_fragment.js
var PrivacyGuideAdTopicsFragmentElementBase = PrefsMixin(PolymerElement);
var PrivacyGuideAdTopicsFragmentElement = class extends PrivacyGuideAdTopicsFragmentElementBase {
	static get is() {
		return "privacy-guide-ad-topics-fragment";
	}
	static get template() {
		return getTemplate$13();
	}
	startStateAdTopicsOn_;
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	ready() {
		super.ready();
		this.addEventListener("view-enter-start", this.onViewEnterStart_);
		this.addEventListener("view-exit-finish", this.onViewExitFinish_);
	}
	focus() {
		this.shadowRoot.querySelector("[focus-element]").focus();
	}
	onViewEnterStart_() {
		this.startStateAdTopicsOn_ = this.getPref("privacy_sandbox.m1.topics_enabled").value;
		this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(PrivacyGuideStepsEligibleAndReached.AD_TOPICS_REACHED);
	}
	onViewExitFinish_() {
		const endStateAdTopicsOn = this.getPref("privacy_sandbox.m1.topics_enabled").value;
		let state = null;
		if (this.startStateAdTopicsOn_) state = endStateAdTopicsOn ? PrivacyGuideSettingsStates.AD_TOPICS_ON_TO_ON : PrivacyGuideSettingsStates.AD_TOPICS_ON_TO_OFF;
		else state = endStateAdTopicsOn ? PrivacyGuideSettingsStates.AD_TOPICS_OFF_TO_ON : PrivacyGuideSettingsStates.AD_TOPICS_OFF_TO_OFF;
		this.metricsBrowserProxy_.recordPrivacyGuideSettingsStatesHistogram(state);
	}
	onToggleChange_(e) {
		const target = e.target;
		PrivacySandboxBrowserProxyImpl.getInstance().topicsToggleChanged(target.checked);
		this.metricsBrowserProxy_.recordAction(target.checked ? "Settings.PrivacyGuide.ChangeAdTopicsOn" : "Settings.PrivacyGuide.ChangeAdTopicsOff");
	}
	onPrivacyPolicyLinkClicked_() {
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.AdTopicsPrivacyPolicyLinkClicked");
	}
};
customElements.define(PrivacyGuideAdTopicsFragmentElement.is, PrivacyGuideAdTopicsFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_fragment_shared.css.js
var styleMod$1 = document.createElement("dom-module");
styleMod$1.appendChild(html`
  <template>
    <style include="cr-shared-style settings-shared settings-columned-section">
:host{display:block;flex:1;padding:0 24px}.welcome-completion-header{align-items:center;display:flex;flex:1;flex-direction:column;justify-content:space-between;text-align:center}.welcome-completion-header picture{animation:fade-in 1500ms,slide-in 300ms}.welcome-completion-header-label{align-self:center;color:var(--google-grey-800);font-size:22px;font-weight:400;line-height:1.15;justify-content:center;outline:none;padding:0}@media (prefers-color-scheme:dark){.welcome-completion-header-label{color:var(--google-grey-200)}}.settings-fragment-header{align-items:center;display:flex;flex-direction:column;outline:none;padding:24px 0 16px 0}.settings-fragment-header-label{animation:fade-in var(--privacy-guide-animation-duration);align-self:center;color:var(--cr-primary-text-color);font-size:138%;font-weight:400;justify-content:center}@keyframes fade-in{0%{opacity:0}100%{opacity:1}}@keyframes slide-in{0%{transform:translateX(calc(var(--privacy-guide-translate-multiplier) * 20px))}100%{transform:translateX(0)}}.welcome-completion-header-label,.cr-secondary-text,.settings-fragment-header picture,.fragment-content{animation:fade-in var(--privacy-guide-animation-duration),slide-in 450ms}.embedded-setting-wrapper{border:1px solid var(--google-grey-300);border-radius:4px}@media (prefers-color-scheme:dark){.embedded-setting-wrapper{border-color:var(--google-grey-700)}}settings-collapse-radio-button:not(:first-of-type){--settings-collapse-separator-line:var(--cr-separator-line)}settings-toggle-button{padding-bottom:8px;padding-top:8px}picture{align-items:center;display:flex}
    </style>
  </template>
`.content);
styleMod$1.register("privacy-guide-fragment-shared");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/clear_browsing_data_dialog/clear_browsing_data_browser_proxy.js
/**
* @fileoverview A helper object used from the "Clear browsing data" dialog
* to interact with the browser.
*/
var TimePeriod;
(function(TimePeriod) {
	TimePeriod[TimePeriod["LAST_HOUR"] = 0] = "LAST_HOUR";
	TimePeriod[TimePeriod["LAST_DAY"] = 1] = "LAST_DAY";
	TimePeriod[TimePeriod["LAST_WEEK"] = 2] = "LAST_WEEK";
	TimePeriod[TimePeriod["FOUR_WEEKS"] = 3] = "FOUR_WEEKS";
	TimePeriod[TimePeriod["ALL_TIME"] = 4] = "ALL_TIME";
	TimePeriod[TimePeriod["LAST_15_MINUTES"] = 6] = "LAST_15_MINUTES";
	TimePeriod[TimePeriod["TIME_PERIOD_LAST"] = 6] = "TIME_PERIOD_LAST";
})(TimePeriod || (TimePeriod = {}));
var BrowsingDataType;
(function(BrowsingDataType) {
	BrowsingDataType[BrowsingDataType["HISTORY"] = 0] = "HISTORY";
	BrowsingDataType[BrowsingDataType["CACHE"] = 1] = "CACHE";
	BrowsingDataType[BrowsingDataType["SITE_DATA"] = 2] = "SITE_DATA";
	BrowsingDataType[BrowsingDataType["FORM_DATA"] = 4] = "FORM_DATA";
	BrowsingDataType[BrowsingDataType["SITE_SETTINGS"] = 5] = "SITE_SETTINGS";
	BrowsingDataType[BrowsingDataType["DOWNLOADS"] = 6] = "DOWNLOADS";
	BrowsingDataType[BrowsingDataType["HOSTED_APPS_DATA"] = 7] = "HOSTED_APPS_DATA";
})(BrowsingDataType || (BrowsingDataType = {}));
var ClearBrowsingDataBrowserProxyImpl = class ClearBrowsingDataBrowserProxyImpl {
	clearBrowsingData(dataTypes, timePeriod) {
		return sendWithPromise("clearBrowsingData", dataTypes, timePeriod);
	}
	initialize() {
		return sendWithPromise("initializeClearBrowsingData");
	}
	getSyncState() {
		return sendWithPromise("getSyncState");
	}
	restartCounters(isBasic, timePeriod) {
		chrome.send("restartClearBrowsingDataCounters", [isBasic, timePeriod]);
	}
	recordSettingsClearBrowsingDataBasicTimePeriodHistogram(bucket) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.ClearBrowsingData.Basic.TimePeriod",
			bucket,
			TimePeriod.TIME_PERIOD_LAST
		]);
	}
	recordSettingsClearBrowsingDataAdvancedTimePeriodHistogram(bucket) {
		chrome.send("metricsHandler:recordInHistogram", [
			"Settings.ClearBrowsingData.Advanced.TimePeriod",
			bucket,
			TimePeriod.TIME_PERIOD_LAST
		]);
	}
	static getInstance() {
		return instance$10 || (instance$10 = new ClearBrowsingDataBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$10 = obj;
	}
};
var instance$10 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/hats_browser_proxy.js
/**
* All Trust & Safety based interactions which may result in a HaTS survey.
*
* Must be kept in sync with the enum of the same name in hats_handler.h.
*/
var TrustSafetyInteraction;
(function(TrustSafetyInteraction) {
	TrustSafetyInteraction[TrustSafetyInteraction["RAN_SAFETY_CHECK"] = 0] = "RAN_SAFETY_CHECK";
	TrustSafetyInteraction[TrustSafetyInteraction["USED_PRIVACY_CARD"] = 1] = "USED_PRIVACY_CARD";
	TrustSafetyInteraction[TrustSafetyInteraction["OPENED_PASSWORD_MANAGER"] = 3] = "OPENED_PASSWORD_MANAGER";
	TrustSafetyInteraction[TrustSafetyInteraction["COMPLETED_PRIVACY_GUIDE"] = 4] = "COMPLETED_PRIVACY_GUIDE";
	TrustSafetyInteraction[TrustSafetyInteraction["RAN_PASSWORD_CHECK"] = 5] = "RAN_PASSWORD_CHECK";
})(TrustSafetyInteraction || (TrustSafetyInteraction = {}));
/**
* Enumeration of interactions with the security settings v2 page. Must be kept
* in sync with the enum of the same name located in:
* chrome/browser/ui/webui/settings/hats_handler.h
*/
var SecurityPageV2Interaction;
(function(SecurityPageV2Interaction) {
	SecurityPageV2Interaction[SecurityPageV2Interaction["STANDARD_BUNDLE_RADIO_BUTTON_CLICK"] = 0] = "STANDARD_BUNDLE_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["ENHANCED_BUNDLE_RADIO_BUTTON_CLICK"] = 1] = "ENHANCED_BUNDLE_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SAFE_BROWSING_ROW_EXPANDED"] = 2] = "SAFE_BROWSING_ROW_EXPANDED";
	SecurityPageV2Interaction[SecurityPageV2Interaction["STANDARD_SAFE_BROWSING_RADIO_BUTTON_CLICK"] = 3] = "STANDARD_SAFE_BROWSING_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["ENHANCED_SAFE_BROWSING_RADIO_BUTTON_CLICK"] = 4] = "ENHANCED_SAFE_BROWSING_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SAFE_BROWSING_TOGGLE_CLICK"] = 5] = "SAFE_BROWSING_TOGGLE_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SECURE_DNS_V2_ROW_EXPANDED"] = 6] = "SECURE_DNS_V2_ROW_EXPANDED";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SECURE_DNS_V2_AUTOMATIC_RADIO_BUTTON_CLICK"] = 7] = "SECURE_DNS_V2_AUTOMATIC_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SECURE_DNS_V2_FALLBACK_RADIO_BUTTON_CLICK"] = 8] = "SECURE_DNS_V2_FALLBACK_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SECURE_DNS_V2_CUSTOM_RADIO_BUTTON_CLICK"] = 9] = "SECURE_DNS_V2_CUSTOM_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SECURE_DNS_V2_TOGGLE_CLICK"] = 10] = "SECURE_DNS_V2_TOGGLE_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["HTTPS_FIRST_MODE_TOGGLE_CLICK"] = 11] = "HTTPS_FIRST_MODE_TOGGLE_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["BALANCED_HTTPS_FIRST_MODE_RADIO_BUTTON_CLICK"] = 12] = "BALANCED_HTTPS_FIRST_MODE_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["STRICT_HTTPS_FIRST_MODE_RADIO_BUTTON_CLICK"] = 13] = "STRICT_HTTPS_FIRST_MODE_RADIO_BUTTON_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["PASSWORD_LEAK_DETECTION_TOGGLE_CLICK"] = 14] = "PASSWORD_LEAK_DETECTION_TOGGLE_CLICK";
	SecurityPageV2Interaction[SecurityPageV2Interaction["SECURE_DNS_TOGGLE_CLICK"] = 15] = "SECURE_DNS_TOGGLE_CLICK";
})(SecurityPageV2Interaction || (SecurityPageV2Interaction = {}));
/** Enumeration of all security settings bundle modes.*/
var SecuritySettingsBundleSetting;
(function(SecuritySettingsBundleSetting) {
	SecuritySettingsBundleSetting[SecuritySettingsBundleSetting["STANDARD"] = 0] = "STANDARD";
	SecuritySettingsBundleSetting[SecuritySettingsBundleSetting["ENHANCED"] = 1] = "ENHANCED";
})(SecuritySettingsBundleSetting || (SecuritySettingsBundleSetting = {}));
var HatsBrowserProxyImpl = class HatsBrowserProxyImpl {
	trustSafetyInteractionOccurred(interaction) {
		chrome.send("trustSafetyInteractionOccurred", [interaction]);
	}
	securityPageHatsRequest(securityPageInteractions, safeBrowsingSetting, totalTimeOnPage, securitySettingsBundleSetting) {
		chrome.send("securityPageHatsRequest", [
			securityPageInteractions,
			safeBrowsingSetting,
			totalTimeOnPage,
			securitySettingsBundleSetting
		]);
	}
	now() {
		return window.performance.now();
	}
	static getInstance() {
		return instance$9 || (instance$9 = new HatsBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$9 = obj;
	}
};
var instance$9 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_completion_fragment.html.js
function getTemplate$12() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared settings-shared">:host{display:flex;flex-flow:column;min-height:calc(400px - var(--privacy-guide-footer-total-height))}.welcome-completion-header{padding:24px 0 16px 0}cr-link-row{--cr-link-row-icon-width:24px;--iron-icon-height:24px;border-radius:4px;padding-inline-end:8px;padding-inline-start:4px}cr-link-row::part(icon){--cr-icon-button-icon-size:24px}.label{font-size:0.875rem}.footer{align-items:center;bottom:calc(-1 * var(--privacy-guide-footer-total-height));display:flex;justify-content:space-between;padding:var(--privacy-guide-footer-vertical-padding) 0;position:absolute;width:calc(100% - 48px)}</style>
<div class="welcome-completion-header">
  <picture>
    <source
        srcset="./images/privacy_guide/completion_banner_dark_v2.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/completion_banner_v2.svg">
  </picture>
  <h2 class="welcome-completion-header-label" tabindex="-1">
    $i18n{privacyGuideCompletionCardHeader}
  </h2>
  <div class="cr-secondary-text">[[getSubheader_(isNoLinkLayout_)]]</div>
</div>
<template is="dom-if" if="[[shouldShowPrivacySandbox_]]">
  <cr-link-row id="privacySandboxRow" using-slotted-label
      sub-label="[[computePrivacySandboxRowSubLabel_(
        shouldShowV2AdPrivacySubLabel_)]]"
      start-icon="privacy20:ads-click" external
      on-click="onPrivacySandboxClick_">
    <div slot="label" class="label">
      $i18n{privacyGuideCompletionCardPrivacySandboxLabel}
    </div>
  </cr-link-row>
  <div aria-disabled="true" role="none">
    <a id="privacySandboxLink" href="adPrivacy"
        target="_blank" tabindex="-1" aria-disabled="true"
        role="none"></a>
  </div>
</template>
<template is="dom-if" if="[[shouldShowAiSettings_]]">
  <cr-link-row id="aiRow" using-slotted-label
      sub-label="$i18n{privacyGuideCompletionCardAiSettingsLabel}"
      start-icon="settings20:magic" external on-click="onAiRowClick_">
    <div slot="label" class="label">$i18n{aiInnovationsPageTitle}</div>
  </cr-link-row>
  <div aria-disabled="true" role="none">
    <a id="aiRowLink" href="ai" target="_blank" tabindex="-1"
        aria-disabled="true" role="none"></a>
  </div>
</template>
<template is="dom-if" if="[[shouldShowWaa_]]">
  <cr-link-row id="waaRow" using-slotted-label
      sub-label="$i18n{privacyGuideCompletionCardWaaSubLabel}"
      start-icon="settings:devices" external
      on-click="onWaaClick_">
      <div slot="label" class="label">
        $i18n{privacyGuideCompletionCardWaaLabel}
      </div>
  </cr-link-row>
</template>
<div class="footer">
  <cr-button id="backButton" role="button" on-click="onBackButtonClick_">
    $i18n{privacyGuideBackButton}
  </cr-button>
  <cr-button class="action-button" id="leaveButton"
      on-click="onLeaveButtonClick_">
    $i18n{privacyGuideCompletionCardLeaveButton}
  </cr-button>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_completion_fragment.js
var PrivacyGuideCompletionFragmentElementBase = WebUiListenerMixin(I18nMixin(PolymerElement));
var PrivacyGuideCompletionFragmentElement = class extends PrivacyGuideCompletionFragmentElementBase {
	static get is() {
		return "privacy-guide-completion-fragment";
	}
	static get template() {
		return getTemplate$12();
	}
	static get properties() {
		return {
			isNoLinkLayout_: {
				reflectToAttribute: true,
				type: Boolean,
				computed: "computeIsNoLinkLayout_(shouldShowWaa_,shouldShowPrivacySandbox_)"
			},
			shouldShowAiSettings_: {
				type: Boolean,
				value: () => loadTimeData$2.getBoolean("showAiPage")
			},
			shouldShowPrivacySandbox_: {
				type: Boolean,
				value: () => !loadTimeData$2.getBoolean("isPrivacySandboxRestricted") || loadTimeData$2.getBoolean("isPrivacySandboxRestrictedNoticeEnabled")
			},
			shouldShowWaa_: {
				type: Boolean,
				value: false
			},
			shouldShowV2AdPrivacySubLabel_: {
				type: Boolean,
				value: false
			}
		};
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	privacySandboxBrowserProxy_ = PrivacySandboxBrowserProxyImpl.getInstance();
	ready() {
		super.ready();
		this.addEventListener("view-enter-start", this.onViewEnterStart_);
		this.addWebUiListener("update-sync-state", (event) => this.updateWaaLink_(event.signedIn));
		ClearBrowsingDataBrowserProxyImpl.getInstance().getSyncState().then((status) => this.updateWaaLink_(status.signedIn));
		this.privacySandboxBrowserProxy_.shouldShowPrivacySandboxAdTopicsContentParity().then((state) => {
			this.shouldShowV2AdPrivacySubLabel_ = state;
		});
	}
	focus() {
		const header = this.shadowRoot.querySelector(".welcome-completion-header-label");
		assert(header);
		header.focus();
	}
	onViewEnterStart_() {
		HatsBrowserProxyImpl.getInstance().trustSafetyInteractionOccurred(TrustSafetyInteraction.COMPLETED_PRIVACY_GUIDE);
		this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(PrivacyGuideStepsEligibleAndReached.COMPLETION_REACHED);
	}
	computeIsNoLinkLayout_() {
		return !this.shouldShowWaa_ && !this.shouldShowPrivacySandbox_;
	}
	getSubheader_() {
		return this.computeIsNoLinkLayout_() ? this.i18n("privacyGuideCompletionCardSubHeaderNoLinks") : this.i18n("privacyGuideCompletionCardSubHeader");
	}
	/** Updates the completion card waa link depending on the signin state. */
	updateWaaLink_(isSignedIn) {
		this.shouldShowWaa_ = isSignedIn;
	}
	onBackButtonClick_(e) {
		e.stopPropagation();
		this.dispatchEvent(new CustomEvent("back-button-click", {
			bubbles: true,
			composed: true
		}));
	}
	onLeaveButtonClick_() {
		this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.COMPLETION_NEXT_BUTTON);
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickCompletion");
		this.dispatchEvent(new CustomEvent("close", {
			bubbles: true,
			composed: true
		}));
	}
	onPrivacySandboxClick_() {
		this.metricsBrowserProxy_.recordPrivacyGuideEntryExitHistogram(PrivacyGuideInteractions.PRIVACY_SANDBOX_COMPLETION_LINK);
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.CompletionPSClick");
		this.shadowRoot.querySelector("#privacySandboxLink").dispatchEvent(new MouseEvent("click"));
	}
	onAiRowClick_() {
		this.metricsBrowserProxy_.recordPrivacyGuideEntryExitHistogram(PrivacyGuideInteractions.AI_SETTINGS_COMPLETION_LINK);
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.CompletionAiSettingsClick");
		this.shadowRoot.querySelector("#aiRowLink").dispatchEvent(new MouseEvent("click"));
	}
	onWaaClick_() {
		this.metricsBrowserProxy_.recordPrivacyGuideEntryExitHistogram(PrivacyGuideInteractions.SWAA_COMPLETION_LINK);
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.CompletionSWAAClick");
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$2.getString("activityControlsUrlInPrivacyGuide"));
	}
	computePrivacySandboxRowSubLabel_() {
		return this.i18n(this.shouldShowV2AdPrivacySubLabel_ ? "privacyGuideCompletionCardPrivacySandboxSubLabelAdTopics" : "privacyGuideCompletionCardPrivacySandboxSubLabel");
	}
};
customElements.define(PrivacyGuideCompletionFragmentElement.is, PrivacyGuideCompletionFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/site_settings/site_settings_browser_proxy.js
/**
* @fileoverview A helper object used from the "Site Settings" section to
* interact with the content settings prefs.
*/
/**
* The handler will send a policy source that is similar, but not exactly the
* same as a ControlledBy value. If the DefaultSettingSource is omitted it
* should be treated as 'default'.
* Should be kept in sync with values returned by C++ function
* `ProviderToDefaultSettingSourceString`.
*/
var DefaultSettingSource;
(function(DefaultSettingSource) {
	DefaultSettingSource["POLICY"] = "policy";
	DefaultSettingSource["SUPERVISED_USER"] = "supervised_user";
	DefaultSettingSource["EXTENSION"] = "extension";
	DefaultSettingSource["PREFERENCE"] = "preference";
	DefaultSettingSource["DEFAULT"] = "default";
})(DefaultSettingSource || (DefaultSettingSource = {}));
/**
* Must be kept in sync with the C++ enum of the same name in
* chrome/browser/content_settings/generated_cookie_prefs.h
*/
var ThirdPartyCookieBlockingSetting;
(function(ThirdPartyCookieBlockingSetting) {
	ThirdPartyCookieBlockingSetting[ThirdPartyCookieBlockingSetting["BLOCK_THIRD_PARTY"] = 0] = "BLOCK_THIRD_PARTY";
	ThirdPartyCookieBlockingSetting[ThirdPartyCookieBlockingSetting["INCOGNITO_ONLY"] = 1] = "INCOGNITO_ONLY";
})(ThirdPartyCookieBlockingSetting || (ThirdPartyCookieBlockingSetting = {}));
var SiteSettingsBrowserProxyImpl = class SiteSettingsBrowserProxyImpl {
	setDefaultValueForContentType(contentType, defaultValue) {
		chrome.send("setDefaultValueForContentType", [contentType, defaultValue]);
	}
	getDefaultValueForContentType(contentType) {
		return sendWithPromise("getDefaultValueForContentType", contentType);
	}
	getAllSites() {
		return sendWithPromise("getAllSites");
	}
	getCategoryList(origin) {
		return sendWithPromise("getCategoryList", origin);
	}
	getRecentSitePermissions(numSources) {
		return sendWithPromise("getRecentSitePermissions", numSources);
	}
	getChooserExceptionList(chooserType) {
		return sendWithPromise("getChooserExceptionList", chooserType);
	}
	getFormattedBytes(numBytes) {
		return sendWithPromise("getFormattedBytes", numBytes);
	}
	getExceptionList(contentType) {
		return sendWithPromise("getExceptionList", contentType);
	}
	getStorageAccessExceptionList(categorySubtype) {
		return sendWithPromise("getStorageAccessExceptionList", categorySubtype);
	}
	getFileSystemGrants() {
		return sendWithPromise("getFileSystemGrants");
	}
	revokeFileSystemGrant(origin, filePath) {
		chrome.send("revokeFileSystemGrant", [origin, filePath]);
	}
	revokeFileSystemGrants(origin) {
		chrome.send("revokeFileSystemGrants", [origin]);
	}
	getOriginPermissions(origin, contentTypes) {
		return sendWithPromise("getOriginPermissions", origin, contentTypes);
	}
	setOriginPermissions(origin, category, blanketSetting) {
		chrome.send("setOriginPermissions", [
			origin,
			category,
			blanketSetting
		]);
	}
	resetCategoryPermissionForPattern(primaryPattern, secondaryPattern, contentType, incognito) {
		chrome.send("resetCategoryPermissionForPattern", [
			primaryPattern,
			secondaryPattern,
			contentType,
			incognito
		]);
	}
	resetChooserExceptionForSite(chooserType, origin, exception) {
		chrome.send("resetChooserExceptionForSite", [
			chooserType,
			origin,
			exception
		]);
	}
	setCategoryPermissionForPattern(primaryPattern, secondaryPattern, contentType, value, incognito) {
		chrome.send("setCategoryPermissionForPattern", [
			primaryPattern,
			secondaryPattern,
			contentType,
			value,
			incognito
		]);
	}
	isOriginValid(origin) {
		return sendWithPromise("isOriginValid", origin);
	}
	isPatternValidForType(pattern, category) {
		return sendWithPromise("isPatternValidForType", pattern, category);
	}
	initializeCaptureDevices(type) {
		chrome.send("initializeCaptureDevices", [type]);
	}
	setPreferredCaptureDevice(type, defaultValue) {
		chrome.send("setPreferredCaptureDevice", [type, defaultValue]);
	}
	observeProtocolHandlers() {
		chrome.send("observeProtocolHandlers");
	}
	observeAppProtocolHandlers() {
		chrome.send("observeAppProtocolHandlers");
	}
	observeProtocolHandlersEnabledState() {
		chrome.send("observeProtocolHandlersEnabledState");
	}
	setProtocolHandlerDefault(enabled) {
		chrome.send("setHandlersEnabled", [enabled]);
	}
	setProtocolDefault(protocol, url) {
		chrome.send("setDefault", [protocol, url]);
	}
	removeProtocolHandler(protocol, url) {
		chrome.send("removeHandler", [protocol, url]);
	}
	removeAppAllowedHandler(protocol, url, appId) {
		chrome.send("removeAppAllowedHandler", [
			protocol,
			url,
			appId
		]);
	}
	removeAppDisallowedHandler(protocol, url, appId) {
		chrome.send("removeAppDisallowedHandler", [
			protocol,
			url,
			appId
		]);
	}
	updateIncognitoStatus() {
		chrome.send("updateIncognitoStatus");
	}
	fetchZoomLevels() {
		chrome.send("fetchZoomLevels");
	}
	removeZoomLevel(host) {
		chrome.send("removeZoomLevel", [host]);
	}
	fetchBlockAutoplayStatus() {
		chrome.send("fetchBlockAutoplayStatus");
	}
	setBlockAutoplayEnabled(enabled) {
		chrome.send("setBlockAutoplayEnabled", [enabled]);
	}
	clearSiteGroupDataAndCookies(groupingKey) {
		chrome.send("clearSiteGroupDataAndCookies", [groupingKey]);
	}
	clearUnpartitionedOriginDataAndCookies(origin) {
		chrome.send("clearUnpartitionedUsage", [origin]);
	}
	clearPartitionedOriginDataAndCookies(origin, groupingKey) {
		chrome.send("clearPartitionedUsage", [origin, groupingKey]);
	}
	recordAction(action) {
		chrome.send("recordAction", [action]);
	}
	getRwsMembershipLabel(rwsNumMembers, rwsOwner) {
		return sendWithPromise("getRwsMembershipLabel", rwsNumMembers, rwsOwner);
	}
	getNumCookiesString(numCookies) {
		return sendWithPromise("getNumCookiesString", numCookies);
	}
	getSystemDeniedPermissions() {
		return sendWithPromise("getSystemDeniedPermissions");
	}
	openSystemPermissionSettings(contentType) {
		chrome.send("openSystemPermissionSettings", [contentType]);
	}
	static getInstance() {
		return instance$8 || (instance$8 = new SiteSettingsBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$8 = obj;
	}
};
var instance$8 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_cookies_fragment.html.js
function getTemplate$11() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared"></style>
<div class="settings-fragment-header" focus-element tabindex="-1">
  <picture>
    <source
        srcset="./images/privacy_guide/cookies_graphic_dark_v2.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/cookies_graphic_v2.svg">
  </picture>
  <h2 class="settings-fragment-header-label">
    $i18n{privacyGuideCookiesCardHeader}
  </h2>
</div>
<div class="fragment-content">
  <settings-radio-group id="cookiesRadioGroup"
      pref="{{prefs.generated.third_party_cookie_blocking_setting}}"
      selectable-elements="settings-collapse-radio-button">
    <settings-collapse-radio-button id="allow3pcs"
        pref="[[prefs.generated.third_party_cookie_blocking_setting]]"
        name="[[thirdPartyCookieBlockingSettingEnum_.INCOGNITO_ONLY]]"
        label="$i18n{privacyGuideCookiesCardBlockTpcAllowSubheader}"
        expand-aria-label="$i18n{allowThirdPartyCookiesExpandA11yLabel}"
        on-click="onCookies3pIncognitoClick_">
      <div slot="collapse" class="settings-columned-section">
        <div class="column">
          <h3 class="description-header">$i18n{columnHeadingWhenOn}</h3>
          <ul class="icon-bulleted-list">
            <li>
              <cr-icon icon="settings20:account-circle-filled"
                  aria-hidden="true"></cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsAllowWhenOnBulletOne}
              </div>
            </li>
            <li>
              <cr-icon icon="settings20:web" aria-hidden="true"></cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsAllowWhenOnBulletTwo}
              </div>
            </li>
          </ul>
        </div>
        <div class="column">
          <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
          <ul class="icon-bulleted-list">
            <li>
              <cr-icon icon="settings20:user-attributes-filled"
                  aria-hidden="true"></cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsAllowThingsToConsiderBulletOne}
              </div>
            </li>
            <li>
              <cr-icon icon="settings20:incognito-unfilled" aria-hidden="true">
              </cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsAllowThingsToConsiderBulletTwo}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </settings-collapse-radio-button>
    <settings-collapse-radio-button id="block3pcs"
        pref="[[prefs.generated.third_party_cookie_blocking_setting]]"
        name="[[thirdPartyCookieBlockingSettingEnum_.BLOCK_THIRD_PARTY]]"
        label="$i18n{privacyGuideCookiesCardBlockTpcBlockSubheader}"
        expand-aria-label="$i18n{blockThirdPartyCookiesExpandA11yLabel}"
        on-click="onCookies3pClick_">
      <div slot="collapse" class="settings-columned-section">
        <div class="column">
          <h3 class="description-header">$i18n{columnHeadingWhenOn}</h3>
          <ul class="icon-bulleted-list">
            <li>
              <cr-icon icon="settings20:block" aria-hidden="true">
              </cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsBlockWhenOnBulletOne}
              </div>
            </li>
            <li>
              <cr-icon icon="settings20:broken" aria-hidden="true"></cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsBlockWhenOnBulletTwo}
              </div>
            </li>
          </ul>
        </div>
        <div class="column">
          <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
          <ul class="icon-bulleted-list">
            <li>
              <cr-icon icon="settings:domain-verification" aria-hidden="true">
              </cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsBlockThingsToConsiderBulletOne}
              </div>
            </li>
            <li>
              <cr-icon icon="settings20:fact-check" aria-hidden="true">
              </cr-icon>
              <div class="secondary">
                $i18n{privacyGuideCookieSettingsBlockThingsToConsiderBulletTwo}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </settings-collapse-radio-button>
  </settings-radio-group>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_cookies_fragment.js
var PrivacyGuideCookiesFragmentBase = PrefsMixin(PolymerElement);
var PrivacyGuideCookiesFragmentElement = class extends PrivacyGuideCookiesFragmentBase {
	static get is() {
		return "privacy-guide-cookies-fragment";
	}
	static get template() {
		return getTemplate$11();
	}
	static get properties() {
		return { thirdPartyCookieBlockingSettingEnum_: {
			type: Object,
			value: ThirdPartyCookieBlockingSetting
		} };
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	startStateBlock3PIncognito_;
	ready() {
		super.ready();
		this.addEventListener("view-enter-start", this.onViewEnterStart_);
		this.addEventListener("view-exit-finish", this.onViewExitFinish_);
	}
	focus() {
		this.shadowRoot.querySelector("[focus-element]").focus();
	}
	onViewEnterStart_() {
		this.startStateBlock3PIncognito_ = this.getPref("generated.third_party_cookie_blocking_setting").value === ThirdPartyCookieBlockingSetting.INCOGNITO_ONLY;
		this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(PrivacyGuideStepsEligibleAndReached.COOKIES_REACHED);
	}
	onViewExitFinish_() {
		const endStateBlock3PIncognito = this.getPref("generated.third_party_cookie_blocking_setting").value === ThirdPartyCookieBlockingSetting.INCOGNITO_ONLY;
		let state = null;
		if (this.startStateBlock3PIncognito_) state = endStateBlock3PIncognito ? PrivacyGuideSettingsStates.BLOCK_3P_INCOGNITO_TO_3P_INCOGNITO : PrivacyGuideSettingsStates.BLOCK_3P_INCOGNITO_TO_3P;
		else state = endStateBlock3PIncognito ? PrivacyGuideSettingsStates.BLOCK_3P_TO_3P_INCOGNITO : PrivacyGuideSettingsStates.BLOCK_3P_TO_3P;
		this.metricsBrowserProxy_.recordPrivacyGuideSettingsStatesHistogram(state);
	}
	onCookies3pIncognitoClick_() {
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeCookiesBlock3PIncognito");
	}
	onCookies3pClick_() {
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeCookiesBlock3P");
	}
};
customElements.define(PrivacyGuideCookiesFragmentElement.is, PrivacyGuideCookiesFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/constants.js
/**
* Steps in the privacy guide flow in their order of appearance. The page
* updates from those steps to show the corresponding page content.
*/
var PrivacyGuideStep;
(function(PrivacyGuideStep) {
	PrivacyGuideStep["WELCOME"] = "welcome";
	PrivacyGuideStep["MSBB"] = "msbb";
	PrivacyGuideStep["HISTORY_SYNC"] = "historySync";
	PrivacyGuideStep["SAFE_BROWSING"] = "safeBrowsing";
	PrivacyGuideStep["COOKIES"] = "cookies";
	PrivacyGuideStep["AD_TOPICS"] = "adTopics";
	PrivacyGuideStep["COMPLETION"] = "completion";
})(PrivacyGuideStep || (PrivacyGuideStep = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_history_sync_fragment.html.js
function getTemplate$10() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared"></style>
<div class="settings-fragment-header" focus-element tabindex="-1">
  <picture>
    <source
        srcset="./images/privacy_guide/history_sync_graphic_dark_v2.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/history_sync_graphic_v2.svg">
  </picture>
  <h2 class="settings-fragment-header-label">
    [[historySyncCardHeader_]]
  </h2>
</div>
<div class="fragment-content">
  <div class="embedded-setting-wrapper">
    <settings-toggle-button id="historyToggle"
        pref="{{historySyncVirtualPref_}}"
        on-change="onToggleClick_"
        label="[[historySyncToggleLabel_]]">
    </settings-toggle-button>
  </div>
  <div class="settings-columned-section">
    <div class="column">
      <h3 class="description-header">
        $i18n{columnHeadingWhenOn}
      </h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:history" aria-hidden="true"></cr-icon>
          <div class="secondary">
            [[historySyncFeatureDescription1_]]
          </div>
        </li>
        <li>
          <cr-icon icon="settings20:dns" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideHistorySyncFeatureDescription2}
          </div>
        </li>
      </ul>
    </div>
    <div class="column">
      <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:link" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideHistorySyncPrivacyDescription1}
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_history_sync_fragment.js
var PrivacyGuideHistorySyncFragmentElementBase = RouteObserverMixin(WebUiListenerMixin(I18nMixin(BaseMixin(PolymerElement))));
var PrivacyGuideHistorySyncFragmentElement = class extends PrivacyGuideHistorySyncFragmentElementBase {
	static get is() {
		return "privacy-guide-history-sync-fragment";
	}
	static get template() {
		return getTemplate$10();
	}
	static get properties() {
		return {
			/** Virtual pref to drive the settings-toggle from syncPrefs. */
			historySyncVirtualPref_: {
				type: Object,
				notify: true,
				value() {
					return {
						type: chrome.settingsPrivate.PrefType.BOOLEAN,
						value: false
					};
				}
			},
			/** @private */
			syncStatus_: Object,
			/**
			* The header for the history sync card. It changes depending on whether
			* the user is signed in.
			* @private
			*/
			historySyncCardHeader_: {
				type: String,
				computed: "computeHistorySyncCardHeader_(syncStatus_)"
			},
			/**
			* The label for the history sync toggle. It changes depending on whether
			* the user is signed in.
			* @private
			*/
			historySyncToggleLabel_: {
				type: String,
				computed: "computeHistorySyncToggleLabel_(syncStatus_)"
			},
			/**
			* The first line of the feature description. It changes depending on
			* whether the user is signed in.
			* @private
			*/
			historySyncFeatureDescription1_: {
				type: String,
				computed: "computeHistorySyncFeatureDescription1_(syncStatus_)"
			}
		};
	}
	syncBrowserProxy_ = SyncBrowserProxyImpl.getInstance();
	syncPrefs_;
	syncAllCache_ = null;
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	startStateHistorySyncOn_;
	firstSyncPrefUpdate_ = true;
	ready() {
		super.ready();
		this.addEventListener("view-enter-start", this.onViewEnterStart_);
		this.addEventListener("view-exit-finish", this.onViewExitFinish_);
		this.addWebUiListener("sync-status-changed", (syncStatus) => this.onSyncStatusChanged_(syncStatus));
		this.syncBrowserProxy_.getSyncStatus().then((syncStatus) => this.onSyncStatusChanged_(syncStatus));
		this.addWebUiListener("sync-prefs-changed", (syncPrefs) => this.onSyncPrefsChange_(syncPrefs));
		this.syncBrowserProxy_.sendSyncPrefsChanged();
	}
	focus() {
		this.shadowRoot.querySelector("[focus-element]").focus();
	}
	onViewEnterStart_() {
		this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(PrivacyGuideStepsEligibleAndReached.HISTORY_SYNC_REACHED);
	}
	onViewExitFinish_() {
		const endStateHistorySyncOn = this.syncPrefs_.typedUrlsSynced;
		let state = null;
		if (this.startStateHistorySyncOn_) state = endStateHistorySyncOn ? PrivacyGuideSettingsStates.HISTORY_SYNC_ON_TO_ON : PrivacyGuideSettingsStates.HISTORY_SYNC_ON_TO_OFF;
		else state = endStateHistorySyncOn ? PrivacyGuideSettingsStates.HISTORY_SYNC_OFF_TO_ON : PrivacyGuideSettingsStates.HISTORY_SYNC_OFF_TO_OFF;
		this.metricsBrowserProxy_.recordPrivacyGuideSettingsStatesHistogram(state);
		this.firstSyncPrefUpdate_ = true;
	}
	currentRouteChanged(newRoute) {
		if (newRoute === routes.PRIVACY_GUIDE && Router.getInstance().getQueryParameters().get("step") === PrivacyGuideStep.HISTORY_SYNC) this.syncAllCache_ = null;
	}
	onSyncStatusChanged_(syncStatus) {
		this.syncStatus_ = syncStatus;
		this.updateHistorySyncVirtualPrefValue_();
	}
	onSyncPrefsChange_(syncPrefs) {
		this.syncPrefs_ = syncPrefs;
		if (this.syncAllCache_ === null) this.syncAllCache_ = this.syncPrefs_.syncAllDataTypes;
		if (this.firstSyncPrefUpdate_) {
			this.startStateHistorySyncOn_ = this.syncPrefs_.typedUrlsSynced;
			this.firstSyncPrefUpdate_ = false;
		}
		this.updateHistorySyncVirtualPrefValue_();
	}
	updateHistorySyncVirtualPrefValue_() {
		if (!this.syncPrefs_) return;
		if (!this.syncStatus_ || this.syncStatus_.signedInState === SignedInState.SIGNED_IN) {
			const mergedToggleValue = this.syncPrefs_.typedUrlsSynced || this.syncPrefs_.tabsSynced || this.syncPrefs_.savedTabGroupsSynced;
			this.set("historySyncVirtualPref_.value", mergedToggleValue);
		} else this.set("historySyncVirtualPref_.value", this.syncPrefs_.syncAllDataTypes || this.syncPrefs_.typedUrlsSynced);
	}
	onToggleClick_() {
		if (!this.syncStatus_ || this.syncStatus_.signedInState === SignedInState.SIGNED_IN) {
			this.syncPrefs_.tabsSynced = this.historySyncVirtualPref_.value;
			this.syncPrefs_.savedTabGroupsSynced = this.historySyncVirtualPref_.value;
		}
		this.syncPrefs_.typedUrlsSynced = this.historySyncVirtualPref_.value;
		this.syncPrefs_.syncAllDataTypes = this.shouldSyncAllBeOn_();
		this.syncBrowserProxy_.setSyncDatatypes(this.syncPrefs_);
		if (this.syncPrefs_.typedUrlsSynced) this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeHistorySyncOn");
		else this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeHistorySyncOff");
	}
	/**
	* If sync all was on when the user reached the history sync card, then
	* disabling and re-enabling history sync while on the card should also
	* re-enable sync all in case all other sync datatypes are also still on.
	*/
	shouldSyncAllBeOn_() {
		if (!this.syncAllCache_) return false;
		for (const datatype of syncPrefsIndividualDataTypes) {
			if (this.syncPrefs_[datatype]) continue;
			if (datatype === "wifiConfigurationsSynced" && !this.syncPrefs_.wifiConfigurationsRegistered) continue;
			return false;
		}
		return true;
	}
	computeHistorySyncCardHeader_(syncStatus) {
		if (syncStatus && syncStatus.signedInState === SignedInState.SIGNED_IN) return this.i18n("privacyGuideHistoryAndTabsSyncCardHeader");
		return this.i18n("privacyGuideHistorySyncCardHeader");
	}
	computeHistorySyncToggleLabel_(syncStatus) {
		if (syncStatus && syncStatus.signedInState === SignedInState.SIGNED_IN) return this.i18n("privacyGuideHistoryAndTabsSyncSettingLabel");
		return this.i18n("privacyGuideHistorySyncSettingLabel");
	}
	computeHistorySyncFeatureDescription1_(syncStatus) {
		if (syncStatus && syncStatus.signedInState === SignedInState.SIGNED_IN) return this.i18n("privacyGuideHistoryAndTabsSyncFeatureDescription1");
		return this.i18n("privacyGuideHistorySyncFeatureDescription1");
	}
};
customElements.define(PrivacyGuideHistorySyncFragmentElement.is, PrivacyGuideHistorySyncFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_msbb_fragment.html.js
function getTemplate$9() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared"></style>
<div class="settings-fragment-header" focus-element tabindex="-1">
  <picture>
    <source
        srcset="./images/privacy_guide/msbb_graphic_dark_v2.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/msbb_graphic_v2.svg">
  </picture>
  <h2 class="settings-fragment-header-label">
    $i18n{privacyGuideMsbbCardHeader}
  </h2>
</div>
<div class="fragment-content">
  <div class="embedded-setting-wrapper">
    <settings-toggle-button id="urlCollectionToggle"
        pref="{{prefs.url_keyed_anonymized_data_collection.enabled}}"
        label="$i18n{urlKeyedAnonymizedDataCollection}"
        on-change="onMsbbToggleClick_">
    </settings-toggle-button>
  </div>
  <div class="settings-columned-section">
    <div class="column">
      <h3 class="description-header">
        $i18n{columnHeadingWhenOn}
      </h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:flash-on" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideMsbbFeatureDescription1}
          </div>
        </li>
        <li>
          <cr-icon icon="settings20:lightbulb" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideMsbbFeatureDescription2}
          </div>
        </li>
        <li>
          <cr-icon icon="settings20:notification-add" aria-hidden="true">
          </cr-icon>
          <div class="secondary">
            $i18n{privacyGuideMsbbFeatureDescription3}
          </div>
        </li>
      </ul>
    </div>
    <div class="column">
      <h3 class="description-header">$i18n{columnHeadingConsider}</h3>
      <ul class="icon-bulleted-list">
        <li>
          <cr-icon icon="settings20:link" aria-hidden="true"></cr-icon>
          <div class="secondary">
            $i18n{privacyGuideMsbbPrivacyDescription1}
          </div>
        </li>
        <li>
          <cr-icon icon="settings20:data-connectors-system" aria-hidden="true">
          </cr-icon>
          <div class="secondary">
            $i18n{privacyGuideMsbbPrivacyDescription2}
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_msbb_fragment.js
var PrivacyGuideMsbbFragmentBase = PrefsMixin(PolymerElement);
var PrivacyGuideMsbbFragmentElement = class extends PrivacyGuideMsbbFragmentBase {
	static get is() {
		return "privacy-guide-msbb-fragment";
	}
	static get template() {
		return getTemplate$9();
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	startStateMsbbOn_;
	ready() {
		super.ready();
		this.addEventListener("view-enter-start", this.onViewEnterStart_);
		this.addEventListener("view-exit-finish", this.onViewExitFinish_);
	}
	focus() {
		this.shadowRoot.querySelector("[focus-element]").focus();
	}
	onViewEnterStart_() {
		this.startStateMsbbOn_ = this.getPref("url_keyed_anonymized_data_collection.enabled").value;
		this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(PrivacyGuideStepsEligibleAndReached.MSBB_REACHED);
	}
	onViewExitFinish_() {
		const endStateMsbbOn = this.getPref("url_keyed_anonymized_data_collection.enabled").value;
		let state = null;
		if (this.startStateMsbbOn_) state = endStateMsbbOn ? PrivacyGuideSettingsStates.MSBB_ON_TO_ON : PrivacyGuideSettingsStates.MSBB_ON_TO_OFF;
		else state = endStateMsbbOn ? PrivacyGuideSettingsStates.MSBB_OFF_TO_ON : PrivacyGuideSettingsStates.MSBB_OFF_TO_OFF;
		this.metricsBrowserProxy_.recordPrivacyGuideSettingsStatesHistogram(state);
	}
	onMsbbToggleClick_() {
		if (this.getPref("url_keyed_anonymized_data_collection.enabled").value) this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeMSBBOn");
		else this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeMSBBOff");
	}
};
customElements.define(PrivacyGuideMsbbFragmentElement.is, PrivacyGuideMsbbFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/security/safe_browsing_types.js
/**
* Enumeration of all safe browsing modes. Must be kept in sync with the enum
* of the same name located in:
* components/safe_browsing/core/common/safe_browsing_prefs.h
*/
var SafeBrowsingSetting;
(function(SafeBrowsingSetting) {
	SafeBrowsingSetting[SafeBrowsingSetting["DISABLED"] = 0] = "DISABLED";
	SafeBrowsingSetting[SafeBrowsingSetting["STANDARD"] = 1] = "STANDARD";
	SafeBrowsingSetting[SafeBrowsingSetting["ENHANCED"] = 2] = "ENHANCED";
})(SafeBrowsingSetting || (SafeBrowsingSetting = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_safe_browsing_fragment.html.js
function getTemplate$8() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared"></style>
<div class="settings-fragment-header" focus-element tabindex="-1">
  <picture>
    <source
        srcset="./images/privacy_guide/safe_browsing_graphic_dark_v2.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/safe_browsing_graphic_v2.svg">
  </picture>
  <h2 class="settings-fragment-header-label">
    $i18n{privacyGuideSafeBrowsingCardHeader}
  </h2>
</div>
<div class="fragment-content">
  <settings-radio-group id="safeBrowsingRadioGroup"
      pref="{{prefs.generated.safe_browsing}}"
      selectable-elements="settings-collapse-radio-button">
    <settings-collapse-radio-button id="safeBrowsingRadioEnhanced"
        pref="[[prefs.generated.safe_browsing]]"
        name="[[safeBrowsingSettingEnum_.ENHANCED]]"
        label="$i18n{safeBrowsingEnhanced}"
        sub-label="$i18n{safeBrowsingEnhancedDescUpdated}"
        expand-aria-label="$i18n{safeBrowsingEnhancedExpandA11yLabel}"
        on-click="onSafeBrowsingEnhancedClick_">
          <div slot="collapse" class="settings-columned-section">
            <div class="column">
              <h3 class="description-header">
                $i18n{columnHeadingWhenOn}
              </h3>
              <ul id="updatedDescItemContainer" class="icon-bulleted-list">
                <li>
                  <cr-icon icon="settings20:data" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedWhenOnBulOne}
                  </div>
                </li>
                <li>
                  <cr-icon icon="settings20:download" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedWhenOnBulTwo}
                  </div>
                </li>
                <li>
                  <cr-icon icon="settings20:gshield" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedWhenOnBulThree}
                  </div>
                </li>
                <li>
                  <cr-icon icon="settings:language" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedWhenOnBulFour}
                  </div>
                </li>
              </ul>
            </div>
            <div class="column">
              <h3 class="description-header">
                $i18n{columnHeadingConsider}
              </h3>
              <ul class="icon-bulleted-list">
                <li>
                  <cr-icon icon="settings20:link" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedThingsToConsiderBulOne}
                  </div>
                </li>
                <li>
                  <cr-icon icon="settings20:account-circle" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedThingsToConsiderBulTwo}
                  </div>
                </li>
                <li>
                  <cr-icon icon="settings:performance" aria-hidden="true">
                  </cr-icon>
                  <div class="secondary">
                    $i18n{safeBrowsingEnhancedThingsToConsiderBulThree}
                  </div>
                </li>
              </ul>
            </div>
          </div>
    </settings-collapse-radio-button>
    <settings-collapse-radio-button id="safeBrowsingRadioStandard"
        no-collapse
        pref="[[prefs.generated.safe_browsing]]"
        name="[[safeBrowsingSettingEnum_.STANDARD]]"
        label="$i18n{safeBrowsingStandard}"
        sub-label="[[getSafeBrowsingStandardSubLabel_(
                    enableHashPrefixRealTimeLookups_)]]"
        expand-aria-label="$i18n{safeBrowsingStandardExpandA11yLabel}"
        on-click="onSafeBrowsingStandardClick_">
    </settings-collapse-radio-button>
  </settings-radio-group>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_safe_browsing_fragment.js
var PrivacyGuideSafeBrowsingFragmentBase = I18nMixin(PrefsMixin(PolymerElement));
var PrivacyGuideSafeBrowsingFragmentElement = class extends PrivacyGuideSafeBrowsingFragmentBase {
	static get is() {
		return "privacy-guide-safe-browsing-fragment";
	}
	static get template() {
		return getTemplate$8();
	}
	static get properties() {
		return {
			/**
			* Valid safe browsing states.
			*/
			safeBrowsingSettingEnum_: {
				type: Object,
				value: SafeBrowsingSetting
			},
			enableHashPrefixRealTimeLookups_: {
				type: Boolean,
				value() {
					return loadTimeData$2.getBoolean("enableHashPrefixRealTimeLookups");
				}
			}
		};
	}
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	startStateEnhanced_;
	ready() {
		super.ready();
		this.addEventListener("view-enter-start", this.onViewEnterStart_);
		this.addEventListener("view-exit-finish", this.onViewExitFinish_);
	}
	focus() {
		this.shadowRoot.querySelector("[focus-element]").focus();
	}
	onViewEnterStart_() {
		this.startStateEnhanced_ = this.getPref("generated.safe_browsing").value === SafeBrowsingSetting.ENHANCED;
		this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(PrivacyGuideStepsEligibleAndReached.SAFE_BROWSING_REACHED);
	}
	onViewExitFinish_() {
		const endStateEnhanced = this.getPref("generated.safe_browsing").value === SafeBrowsingSetting.ENHANCED;
		let state = null;
		if (this.startStateEnhanced_) state = endStateEnhanced ? PrivacyGuideSettingsStates.SAFE_BROWSING_ENHANCED_TO_ENHANCED : PrivacyGuideSettingsStates.SAFE_BROWSING_ENHANCED_TO_STANDARD;
		else state = endStateEnhanced ? PrivacyGuideSettingsStates.SAFE_BROWSING_STANDARD_TO_ENHANCED : PrivacyGuideSettingsStates.SAFE_BROWSING_STANDARD_TO_STANDARD;
		this.metricsBrowserProxy_.recordPrivacyGuideSettingsStatesHistogram(state);
	}
	onSafeBrowsingEnhancedClick_() {
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeSafeBrowsingEnhanced");
	}
	onSafeBrowsingStandardClick_() {
		this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.ChangeSafeBrowsingStandard");
	}
	getSafeBrowsingStandardSubLabel_() {
		return this.i18n(this.enableHashPrefixRealTimeLookups_ ? "safeBrowsingStandardDescProxy" : "safeBrowsingStandardDesc");
	}
	getStandardProtectionFeatureDescription2_() {
		return this.i18n(this.enableHashPrefixRealTimeLookups_ ? "privacyGuideSafeBrowsingCardStandardProtectionFeatureDescription2Proxy" : "privacyGuideSafeBrowsingCardStandardProtectionFeatureDescription2");
	}
	getStandardProtectionPrivacyDescription1_() {
		return this.i18n(this.enableHashPrefixRealTimeLookups_ ? "privacyGuideSafeBrowsingCardStandardProtectionPrivacyDescription1Proxy" : "privacyGuideSafeBrowsingCardStandardProtectionPrivacyDescription1");
	}
};
customElements.define(PrivacyGuideSafeBrowsingFragmentElement.is, PrivacyGuideSafeBrowsingFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_welcome_fragment.html.js
function getTemplate$7() {
	return Ke`<!--_html_template_start_--><style include="privacy-guide-fragment-shared">:host{display:flex;flex-flow:column;min-height:calc(432px - var(--privacy-guide-footer-total-height))}.welcome-completion-header{padding:48px 116px var(--cr-section-padding) 116px;row-gap:12px}.footer{align-items:center;animation:fade-in var(--privacy-guide-animation-duration);bottom:calc(-1 * var(--privacy-guide-footer-total-height));display:flex;justify-content:flex-end;padding-bottom:var(--privacy-guide-footer-vertical-padding);position:absolute;width:calc(100% - 48px)}</style>
<div class="welcome-completion-header">
  <picture>
    <source
        srcset="./images/privacy_guide/welcome_banner_dark.svg"
        media="(prefers-color-scheme: dark)">
    <img alt="" src="./images/privacy_guide/welcome_banner.svg">
  </picture>
  <h2 class="welcome-completion-header-label" tabindex="-1">
    $i18n{privacyGuideWelcomeCardHeader}
  </h2>
  <div class="cr-secondary-text">$i18n{privacyGuideWelcomeCardSubHeader}</div>
</div>
<div class="footer">
  <cr-button class="action-button" id="startButton"
      on-click="onStartButtonClick_">
    $i18n{privacyGuideNextButton}
  </cr-button>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_welcome_fragment.js
var PrivacyGuideWelcomeFragmentElement = class extends PolymerElement {
	static get is() {
		return "privacy-guide-welcome-fragment";
	}
	static get template() {
		return getTemplate$7();
	}
	focus() {
		const header = this.shadowRoot.querySelector(".welcome-completion-header-label");
		assert(header);
		header.focus();
	}
	onStartButtonClick_(e) {
		e.stopPropagation();
		this.dispatchEvent(new CustomEvent("start-button-click", {
			bubbles: true,
			composed: true
		}));
	}
};
customElements.define(PrivacyGuideWelcomeFragmentElement.is, PrivacyGuideWelcomeFragmentElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/step_indicator.html.js
function getTemplate$6() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style">:host{align-items:center;display:flex}span{background:var(--google-grey-200);border-radius:50%;display:inline-block;height:8px;margin:0 4px;width:8px}span.active{background:var(--google-blue-600)}.screen-reader-only{clip:rect(0,0,0,0);position:fixed}@media (prefers-color-scheme:dark){span{background:var(--google-grey-500)}span.active{background:var(--google-blue-300)}}</style>
<template is="dom-repeat" items="[[dots_]]">
  <span class$="[[getActiveClass_(index, model.active)]]"></span>
</template>
<div class="screen-reader-only">
  [[computeA11yLabel_(model.active, model.total)]]
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/step_indicator.js
/**
* @fileoverview
* 'step-indicator' is an element that displays a row of dots, one of which is
* highlighted, to indicate how far the user is through a multi-step flow.
*/
var StepIndicatorBase = I18nMixin(PolymerElement);
var StepIndicator = class extends StepIndicatorBase {
	static get is() {
		return "step-indicator";
	}
	static get properties() {
		return {
			/**
			* An Object with 'active' and 'total' members, indicating the active dot
			* index and the total number of dots.
			*/
			model: Object,
			/**
			* An array with length equal to the number of dots, for use by
			* dom-repeat. The contents of the array are unused.
			*/
			dots_: {
				type: Array,
				computed: "computeDots_(model.total)"
			}
		};
	}
	/**
	* @return the screenreader label for this element.
	*/
	computeA11yLabel_() {
		return this.i18n("privacyGuideSteps", this.model.active + 1, this.model.total);
	}
	computeDots_() {
		return new Array(this.model.total > 1 ? this.model.total : 0);
	}
	/**
	* Returns a class for the dot at `index`, which will highlight the dot at the
	* active index.
	*/
	getActiveClass_(index) {
		return index === this.model.active ? "active" : "";
	}
	static get template() {
		return getTemplate$6();
	}
};
customElements.define(StepIndicator.is, StepIndicator);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/site_settings/constants.js
/**
* All possible contentSettingsTypes that we currently support configuring in
* the UI. Both top-level categories and content settings that represent
* individual permissions under Site Details should appear here.
* This should be kept in sync with the |kContentSettingsTypeGroupNames| array
* in chrome/browser/ui/webui/settings/site_settings_helper.cc. See
* chrome/browser/resources/settings/site_settings/site_settings_page_util
* for translations.
*/
var ContentSettingsTypes;
(function(ContentSettingsTypes) {
	ContentSettingsTypes["ADS"] = "ads";
	ContentSettingsTypes["ANTI_ABUSE"] = "anti-abuse";
	ContentSettingsTypes["AR"] = "ar";
	ContentSettingsTypes["AUTO_PICTURE_IN_PICTURE"] = "auto-picture-in-picture";
	ContentSettingsTypes["AUTOMATIC_DOWNLOADS"] = "multiple-automatic-downloads";
	ContentSettingsTypes["AUTOMATIC_FULLSCREEN"] = "automatic-fullscreen";
	ContentSettingsTypes["BACKGROUND_SYNC"] = "background-sync";
	ContentSettingsTypes["BLUETOOTH_DEVICES"] = "bluetooth-devices";
	ContentSettingsTypes["BLUETOOTH_SCANNING"] = "bluetooth-scanning";
	ContentSettingsTypes["CAMERA"] = "media-stream-camera";
	ContentSettingsTypes["CAPTURED_SURFACE_CONTROL"] = "captured-surface-control";
	ContentSettingsTypes["CLIPBOARD"] = "clipboard";
	ContentSettingsTypes["COOKIES"] = "cookies";
	ContentSettingsTypes["FEDERATED_IDENTITY_API"] = "federated-identity-api";
	ContentSettingsTypes["FILE_SYSTEM_WRITE"] = "file-system-write";
	ContentSettingsTypes["GEOLOCATION"] = "location";
	ContentSettingsTypes["HAND_TRACKING"] = "hand-tracking";
	ContentSettingsTypes["HID_DEVICES"] = "hid-devices";
	ContentSettingsTypes["IDLE_DETECTION"] = "idle-detection";
	ContentSettingsTypes["IMAGES"] = "images";
	ContentSettingsTypes["JAVASCRIPT"] = "javascript";
	ContentSettingsTypes["JAVASCRIPT_OPTIMIZER"] = "javascript-optimizer";
	ContentSettingsTypes["KEYBOARD_LOCK"] = "keyboard-lock";
	ContentSettingsTypes["LOCAL_FONTS"] = "local-fonts";
	ContentSettingsTypes["LOCAL_NETWORK"] = "local-network";
	ContentSettingsTypes["LOCAL_NETWORK_ACCESS"] = "local-network-access";
	ContentSettingsTypes["LOOPBACK_NETWORK"] = "loopback-network";
	ContentSettingsTypes["MIC"] = "media-stream-mic";
	ContentSettingsTypes["MIDI_DEVICES"] = "midi-sysex";
	ContentSettingsTypes["MIXEDSCRIPT"] = "mixed-script";
	ContentSettingsTypes["NOTIFICATIONS"] = "notifications";
	ContentSettingsTypes["PAYMENT_HANDLER"] = "payment-handler";
	ContentSettingsTypes["PERFORMANCE"] = "performance";
	ContentSettingsTypes["POINTER_LOCK"] = "pointer-lock";
	ContentSettingsTypes["POPUPS"] = "popups";
	ContentSettingsTypes["PRIVATE_NETWORK_DEVICES"] = "private-network-devices";
	ContentSettingsTypes["PROTECTED_CONTENT"] = "protected-content";
	ContentSettingsTypes["PROTOCOL_HANDLERS"] = "register-protocol-handler";
	ContentSettingsTypes["SENSORS"] = "sensors";
	ContentSettingsTypes["SERIAL_PORTS"] = "serial-ports";
	ContentSettingsTypes["SMART_CARD_READERS"] = "smart-card-readers";
	ContentSettingsTypes["SOUND"] = "sound";
	ContentSettingsTypes["STORAGE_ACCESS"] = "storage-access";
	ContentSettingsTypes["TOP_LEVEL_STORAGE_ACCESS"] = "top-level-storage-access";
	ContentSettingsTypes["USB_DEVICES"] = "usb-devices";
	ContentSettingsTypes["VR"] = "vr";
	ContentSettingsTypes["WEB_APP_INSTALLATION"] = "web-app-installation";
	ContentSettingsTypes["WINDOW_MANAGEMENT"] = "window-management";
	ContentSettingsTypes["ZOOM_LEVELS"] = "zoom-levels";
	ContentSettingsTypes["WEB_PRINTING"] = "web-printing";
	ContentSettingsTypes["PDF_DOCUMENTS"] = "pdfDocuments";
	ContentSettingsTypes["SITE_DATA"] = "site-data";
	ContentSettingsTypes["OFFER_WRITING_HELP"] = "offer-writing-help";
})(ContentSettingsTypes || (ContentSettingsTypes = {}));
/**
* Contains the possible string values for a given ContentSettingsTypes.
* This should be kept in sync with the |ContentSetting| enum in
* components/content_settings/core/common/content_settings.h
*/
var ContentSetting;
(function(ContentSetting) {
	ContentSetting["DEFAULT"] = "default";
	ContentSetting["ALLOW"] = "allow";
	ContentSetting["BLOCK"] = "block";
	ContentSetting["ASK"] = "ask";
	ContentSetting["SESSION_ONLY"] = "session_only";
})(ContentSetting || (ContentSetting = {}));
/**
* All possible ChooserTypes that we currently support configuring in the UI.
* This should be kept in sync with the |kChooserTypeGroupNames| array in
* chrome/browser/ui/webui/settings/site_settings_helper.cc
*/
var ChooserType;
(function(ChooserType) {
	ChooserType["NONE"] = "";
	ChooserType["USB_DEVICES"] = "usb-devices-data";
	ChooserType["SERIAL_PORTS"] = "serial-ports-data";
	ChooserType["HID_DEVICES"] = "hid-devices-data";
	ChooserType["BLUETOOTH_DEVICES"] = "bluetooth-devices-data";
	ChooserType["PRIVATE_NETWORK_DEVICES"] = "private-network-devices-data";
})(ChooserType || (ChooserType = {}));
/**
* Possible preference settings for the profile.cookie_controls_mode pref.
* This should be kept in sync with the |CookieControlsMode| enum in
* components/content_settings/core/browser/cookie_settings.h
*/
var CookieControlsMode;
(function(CookieControlsMode) {
	CookieControlsMode[CookieControlsMode["OFF"] = 0] = "OFF";
	CookieControlsMode[CookieControlsMode["BLOCK_THIRD_PARTY"] = 1] = "BLOCK_THIRD_PARTY";
	CookieControlsMode[CookieControlsMode["INCOGNITO_ONLY"] = 2] = "INCOGNITO_ONLY";
})(CookieControlsMode || (CookieControlsMode = {}));
/**
* Contains the possible sources of a ContentSetting.
* This should be kept in sync with the |SiteSettingSource| enum in
* chrome/browser/ui/webui/settings/site_settings_helper.h
*/
var SiteSettingSource;
(function(SiteSettingSource) {
	SiteSettingSource["ADS_FILTER_BLACKLIST"] = "ads-filter-blacklist";
	SiteSettingSource["ALLOWLIST"] = "allowlist";
	SiteSettingSource["DEFAULT"] = "default";
	SiteSettingSource["EMBARGO"] = "embargo";
	SiteSettingSource["EXTENSION"] = "extension";
	SiteSettingSource["HOSTED_APP"] = "HostedApp";
	SiteSettingSource["INSECURE_ORIGIN"] = "insecure-origin";
	SiteSettingSource["KILL_SWITCH"] = "kill-switch";
	SiteSettingSource["POLICY"] = "policy";
	SiteSettingSource["PREFERENCE"] = "preference";
})(SiteSettingSource || (SiteSettingSource = {}));
/**
* Enumeration of states for the notification and geolocation default setting
* generated pref. Must be kept in sync with the SettingsState enum in:
* chrome/browser/content_settings/generated_permission_prompting_behavior_pref.h
*/
var SettingsState;
(function(SettingsState) {
	SettingsState[SettingsState["LOUD"] = 0] = "LOUD";
	SettingsState[SettingsState["QUIET"] = 1] = "QUIET";
	SettingsState[SettingsState["CPSS"] = 2] = "CPSS";
	SettingsState[SettingsState["BLOCK"] = 3] = "BLOCK";
})(SettingsState || (SettingsState = {}));
/**
* Enumeration of states for the Javascript optimizer default setting generated
* pref. Must be kept in sync with the JavascriptOptimizerSetting enum in:
* components/content_settings/browser/ui/javascript_optimizer_setting.h
*/
var JavascriptOptimizerSetting;
(function(JavascriptOptimizerSetting) {
	JavascriptOptimizerSetting[JavascriptOptimizerSetting["BLOCKED"] = 0] = "BLOCKED";
	JavascriptOptimizerSetting[JavascriptOptimizerSetting["ALLOWED"] = 1] = "ALLOWED";
	JavascriptOptimizerSetting[JavascriptOptimizerSetting["BLOCKED_FOR_UNFAMILIAR_SITES"] = 2] = "BLOCKED_FOR_UNFAMILIAR_SITES";
})(JavascriptOptimizerSetting || (JavascriptOptimizerSetting = {}));
/**
* Contains the possible record action types.
* This should be kept in sync with the |AllSitesAction2| enum in
* chrome/browser/ui/webui/settings/site_settings_handler.cc
*/
var AllSitesAction2;
(function(AllSitesAction2) {
	AllSitesAction2[AllSitesAction2["LOAD_PAGE"] = 0] = "LOAD_PAGE";
	AllSitesAction2[AllSitesAction2["RESET_SITE_GROUP_PERMISSIONS"] = 1] = "RESET_SITE_GROUP_PERMISSIONS";
	AllSitesAction2[AllSitesAction2["RESET_ORIGIN_PERMISSIONS"] = 2] = "RESET_ORIGIN_PERMISSIONS";
	AllSitesAction2[AllSitesAction2["CLEAR_ALL_DATA"] = 3] = "CLEAR_ALL_DATA";
	AllSitesAction2[AllSitesAction2["CLEAR_SITE_GROUP_DATA"] = 4] = "CLEAR_SITE_GROUP_DATA";
	AllSitesAction2[AllSitesAction2["CLEAR_ORIGIN_DATA"] = 5] = "CLEAR_ORIGIN_DATA";
	AllSitesAction2[AllSitesAction2["ENTER_SITE_DETAILS"] = 6] = "ENTER_SITE_DETAILS";
	AllSitesAction2[AllSitesAction2["REMOVE_SITE_GROUP"] = 7] = "REMOVE_SITE_GROUP";
	AllSitesAction2[AllSitesAction2["REMOVE_ORIGIN"] = 8] = "REMOVE_ORIGIN";
	AllSitesAction2[AllSitesAction2["REMOVE_ORIGIN_PARTITIONED"] = 9] = "REMOVE_ORIGIN_PARTITIONED";
	AllSitesAction2[AllSitesAction2["FILTER_BY_FPS_OWNER"] = 10] = "FILTER_BY_FPS_OWNER";
	AllSitesAction2[AllSitesAction2["DELETE_FOR_ENTIRE_FPS"] = 11] = "DELETE_FOR_ENTIRE_FPS";
})(AllSitesAction2 || (AllSitesAction2 = {}));
/**
* Contains the possible sort methods.
*/
var SortMethod;
(function(SortMethod) {
	SortMethod["NAME"] = "name";
	SortMethod["MOST_VISITED"] = "most-visited";
	SortMethod["STORAGE"] = "data-stored";
})(SortMethod || (SortMethod = {}));
/**
* Contains types of dialogs on the AllSites page,
* used for logging userActions.
*/
var AllSitesDialog;
(function(AllSitesDialog) {
	AllSitesDialog["CLEAR_DATA"] = "ClearData";
	AllSitesDialog["RESET_PERMISSIONS"] = "ResetPermissions";
})(AllSitesDialog || (AllSitesDialog = {}));
/**
* Types of cookies exceptions based on the use of wildcard in the patterns:
* - THIRD_PARTY: primary pattern is wildcard (third-party exception).
* - SITE_DATA: primary pattern is set, secondary pattern is wildcard (site data
* exceptions) or is set (only possible via extensions API).
* - COMBINED: any pattern combination can be used.
*/
var CookiesExceptionType;
(function(CookiesExceptionType) {
	CookiesExceptionType["THIRD_PARTY"] = "third-party";
	CookiesExceptionType["SITE_DATA"] = "site-data";
	CookiesExceptionType["COMBINED"] = "combined";
})(CookiesExceptionType || (CookiesExceptionType = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_availability_mixin.js
var PrivacyGuideAvailabilityMixin = dedupingMixin((superClass) => {
	const superClassBase = WebUiListenerMixin(superClass);
	class PrivacyGuideAvailabilityMixinInternal extends superClassBase {
		static get properties() {
			return { isPrivacyGuideAvailable: {
				type: Boolean,
				value: () => loadTimeData$2.getBoolean("showPrivacyGuide")
			} };
		}
		connectedCallback() {
			super.connectedCallback();
			this.addWebUiListener("is-managed-changed", (isManaged) => this.onPrivacyGuideAvailabilityChanged_(!isManaged));
			this.addWebUiListener("sync-status-changed", (syncStatus) => this.onPrivacyGuideAvailabilityChanged_(!syncStatus.supervisedUser));
		}
		onPrivacyGuideAvailabilityChanged_(isAvailable) {
			this.isPrivacyGuideAvailable = this.isPrivacyGuideAvailable && isAvailable;
		}
	}
	return PrivacyGuideAvailabilityMixinInternal;
});
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_browser_proxy.js
var PRIVACY_GUIDE_PROMO_IMPRESSION_COUNT_KEY = "privacy-guide-promo-count";
var PrivacyGuideBrowserProxyImpl = class PrivacyGuideBrowserProxyImpl {
	getPromoImpressionCount() {
		return parseInt(window.localStorage.getItem(PRIVACY_GUIDE_PROMO_IMPRESSION_COUNT_KEY), 10) || 0;
	}
	incrementPromoImpressionCount() {
		window.localStorage.setItem(PRIVACY_GUIDE_PROMO_IMPRESSION_COUNT_KEY, (this.getPromoImpressionCount() + 1).toString());
	}
	privacySandboxPrivacyGuideShouldShowAdTopicsCard() {
		return sendWithPromise("privacySandboxPrivacyGuideShouldShowAdTopicsCard");
	}
	static getInstance() {
		return instance$7 || (instance$7 = new PrivacyGuideBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$7 = obj;
	}
};
var instance$7 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_page.html.js
function getTemplate$5() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">:host{--privacy-guide-animation-duration:900ms;--privacy-guide-footer-vertical-padding:16px;--privacy-guide-footer-total-height:calc(var(--cr-button-height) + 2 * var(--privacy-guide-footer-vertical-padding))}.footer{align-items:center;bottom:0;box-sizing:border-box;display:flex;justify-content:space-between;padding:var(--privacy-guide-footer-vertical-padding) 24px;position:absolute;width:100%}.managed-fragment{bottom:initial;grid-column-start:1;grid-row-start:1;left:initial;position:unset;right:initial;top:initial}#viewManager{position:relative}#viewManager>:not(.active){left:0;position:absolute;top:0}.visibility-hidden{visibility:hidden}#privacyGuideCard{background-color:var(--cr-card-background-color);border-radius:var(--cr-card-border-radius);box-shadow:var(--cr-card-shadow);box-sizing:border-box;display:flex;flex-flow:column;min-height:432px;padding-bottom:var(--privacy-guide-footer-total-height);position:relative}@keyframes fade-in{0%{opacity:0}100%{opacity:1}}#background{animation:fade-in var(--privacy-guide-animation-duration);height:100px;left:50%;position:absolute;top:24px;transform:translateX(-50%);width:360px}#background picture{display:block;height:100%;left:0;position:absolute;top:0;width:100%}#backgroundClouds{transform:translateX(calc(var(--privacy-guide-step) * -4px));transition:transform 300ms cubic-bezier(.4,0,.2,1)}:host-context([dir='rtl']) #backgroundClouds{transform:translateX(calc(var(--privacy-guide-step) * 4px))}#backgroundHills{transform:translateX(calc(var(--privacy-guide-step) * -2px));transition:transform 300ms cubic-bezier(.4,0,.2,1)}:host-context([dir='rtl']) #backgroundHills{transform:translateX(calc(var(--privacy-guide-step) * 2px))}</style>
<div id="privacyGuideCard" on-keydown="onKeyDown_" part="privacyGuideCard"
    style="--privacy-guide-translate-multiplier: [[translateMultiplier_]]">
  <div id="background" aria-hidden="true"
      hidden$="[[!showAnySettingFragment_(privacyGuideStep_)]]"
      style="--privacy-guide-step: [[stepIndicatorModel_.active]]">
    <picture id="backgroundClouds">
      <source
          srcset="./images/privacy_guide/clouds_graphic_dark.svg"
          media="(prefers-color-scheme: dark)">
      <img alt="" src="./images/privacy_guide/clouds_graphic.svg">
    </picture>
    <picture id="backgroundHills">
      <source
          srcset="./images/privacy_guide/hills_graphic_dark.svg"
          media="(prefers-color-scheme: dark)">
      <img alt="" src="./images/privacy_guide/hills_graphic.svg">
    </picture>
    <picture>
      <source
          srcset="./images/privacy_guide/horizon_graphic_dark.svg"
          media="(prefers-color-scheme: dark)">
      <img alt="" src="./images/privacy_guide/horizon_graphic.svg">
    </picture>
  </div>
  <cr-view-manager id="viewManager">
    <privacy-guide-welcome-fragment id="[[privacyGuideStepEnum_.WELCOME]]"
        class="managed-fragment" on-start-button-click="onNextButtonClick_"
        slot="view">
    </privacy-guide-welcome-fragment>
    <privacy-guide-msbb-fragment id="[[privacyGuideStepEnum_.MSBB]]"
        class="managed-fragment" prefs="{{prefs}}" slot="view">
    </privacy-guide-msbb-fragment>
    <privacy-guide-history-sync-fragment
        id="[[privacyGuideStepEnum_.HISTORY_SYNC]]" class="managed-fragment"
        slot="view">
    </privacy-guide-history-sync-fragment>
    <privacy-guide-cookies-fragment id="[[privacyGuideStepEnum_.COOKIES]]"
        class="managed-fragment" prefs="{{prefs}}" slot="view">
    </privacy-guide-cookies-fragment>
    <privacy-guide-safe-browsing-fragment
        id="[[privacyGuideStepEnum_.SAFE_BROWSING]]" class="managed-fragment"
        prefs="{{prefs}}" slot="view">
    </privacy-guide-safe-browsing-fragment>
    <privacy-guide-ad-topics-fragment
        id="[[privacyGuideStepEnum_.AD_TOPICS]]" class="managed-fragment"
        prefs="{{prefs}}" slot="view">
    </privacy-guide-ad-topics-fragment>
    <privacy-guide-completion-fragment
        id="[[privacyGuideStepEnum_.COMPLETION]]" class="managed-fragment"
        on-back-button-click="onBackButtonClick_" slot="view">
    </privacy-guide-completion-fragment>
  </cr-view-manager>
  <template is="dom-if" if="[[showAnySettingFragment_(privacyGuideStep_)]]">
    <div id="settingFooter" class="footer hr">
      <cr-button id="backButton" role="button" on-click="onBackButtonClick_"
          class$="[[computeBackButtonClass_(privacyGuideStep_)]]">
        $i18n{privacyGuideBackButton}
      </cr-button>
      <step-indicator model="[[stepIndicatorModel_]]"></step-indicator>
      <cr-button class="action-button" id="nextButton" role="button"
          tabindex="0" on-click="onNextButtonClick_">
        $i18n{privacyGuideNextButton}
      </cr-button>
    </div>
  </template>
</div>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_page.js
function eligibilityToRecord(step) {
	switch (step) {
		case PrivacyGuideStep.MSBB: return PrivacyGuideStepsEligibleAndReached.MSBB_ELIGIBLE;
		case PrivacyGuideStep.HISTORY_SYNC: return PrivacyGuideStepsEligibleAndReached.HISTORY_SYNC_ELIGIBLE;
		case PrivacyGuideStep.COOKIES: return PrivacyGuideStepsEligibleAndReached.COOKIES_ELIGIBLE;
		case PrivacyGuideStep.SAFE_BROWSING: return PrivacyGuideStepsEligibleAndReached.SAFE_BROWSING_ELIGIBLE;
		case PrivacyGuideStep.AD_TOPICS: return PrivacyGuideStepsEligibleAndReached.AD_TOPICS_ELIGIBLE;
		case PrivacyGuideStep.COMPLETION: return PrivacyGuideStepsEligibleAndReached.COMPLETION_ELIGIBLE;
		default: assertNotReached();
	}
}
var PrivacyGuideBase = RouteObserverMixin(PrivacyGuideAvailabilityMixin(WebUiListenerMixin(I18nMixin(PrefsMixin(PolymerElement)))));
var SettingsPrivacyGuidePageElement = class extends PrivacyGuideBase {
	static get is() {
		return "settings-privacy-guide-page";
	}
	static get template() {
		return getTemplate$5();
	}
	static get properties() {
		return {
			/**
			* Valid privacy guide states.
			*/
			privacyGuideStepEnum_: {
				type: Object,
				value: PrivacyGuideStep
			},
			/**
			* The current step in the privacy guide flow, or `undefined` if the flow
			* has not yet been initialized from query parameters.
			*/
			privacyGuideStep_: {
				type: String,
				value: void 0
			},
			/**
			* Multiplier to apply on translate distances for animations in fragments.
			* +1 if navigating forwards LTR or backwards RTL; -1 if navigating
			* forwards RTL or backwards LTR.
			*/
			translateMultiplier_: {
				type: Number,
				value: 1
			},
			/**
			* Used by the 'step-indicator' element to display its dots.
			*/
			stepIndicatorModel_: {
				type: Object,
				computed: "computeStepIndicatorModel(privacyGuideStep_, prefs.generated.cookie_default_content_setting, prefs.generated.safe_browsing, prefs.generated.third_party_cookie_blocking_setting, prefs.net.network_prediction_options)"
			},
			shouldShowAdTopicsCard_: {
				type: Boolean,
				value: false
			},
			syncStatus_: Object
		};
	}
	static get observers() {
		return ["onPrefsChanged_(prefs.generated.cookie_default_content_setting, prefs.generated.safe_browsing, prefs.generated.third_party_cookie_blocking_setting, prefs.net.network_prediction_options)", "exitIfNecessary(isPrivacyGuideAvailable)"];
	}
	privacyGuideStepToComponentsMap_;
	syncBrowserProxy_ = SyncBrowserProxyImpl.getInstance();
	animationsEnabled_ = true;
	metricsBrowserProxy_ = MetricsBrowserProxyImpl.getInstance();
	privacyGuideBrowserProxy_ = PrivacyGuideBrowserProxyImpl.getInstance();
	constructor() {
		super();
		this.privacyGuideStepToComponentsMap_ = this.computePrivacyGuideStepToComponentsMap_();
	}
	ready() {
		super.ready();
		this.addWebUiListener("sync-status-changed", (syncStatus) => this.onSyncStatusChanged_(syncStatus));
		this.syncBrowserProxy_.getSyncStatus().then((syncStatus) => this.onSyncStatusChanged_(syncStatus));
		this.privacyGuideBrowserProxy_.privacySandboxPrivacyGuideShouldShowAdTopicsCard().then((state) => {
			this.shouldShowAdTopicsCard_ = state;
		});
	}
	disableAnimationsForTesting() {
		this.animationsEnabled_ = false;
	}
	/** RouteObserverBehavior */
	currentRouteChanged(newRoute) {
		if (newRoute !== routes.PRIVACY_GUIDE || this.exitIfNecessary()) return;
		this.updateStateFromQueryParameters_();
	}
	/**
	* @return the map of privacy guide steps to their components.
	*/
	computePrivacyGuideStepToComponentsMap_() {
		return /* @__PURE__ */ new Map([
			[PrivacyGuideStep.WELCOME, {
				nextStep: PrivacyGuideStep.MSBB,
				isAvailable: () => true,
				recordForwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.WELCOME_NEXT_BUTTON);
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickWelcome");
					this.metricsBrowserProxy_.recordPrivacyGuideFlowLengthHistogram(this.computeStepIndicatorModel().total);
					this.recordEligibleSteps_();
				}
			}],
			[PrivacyGuideStep.MSBB, {
				nextStep: PrivacyGuideStep.HISTORY_SYNC,
				previousStep: PrivacyGuideStep.WELCOME,
				recordForwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.MSBB_NEXT_BUTTON);
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickMSBB");
				},
				recordBackwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.BackClickMSBB");
				},
				isAvailable: () => true
			}],
			[PrivacyGuideStep.HISTORY_SYNC, {
				nextStep: PrivacyGuideStep.SAFE_BROWSING,
				previousStep: PrivacyGuideStep.MSBB,
				recordForwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.HISTORY_SYNC_NEXT_BUTTON);
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickHistorySync");
				},
				recordBackwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.BackClickHistorySync");
				},
				isAvailable: () => !this.syncStatus_ || this.shouldShowHistorySyncCard_()
			}],
			[PrivacyGuideStep.SAFE_BROWSING, {
				nextStep: PrivacyGuideStep.COOKIES,
				previousStep: PrivacyGuideStep.HISTORY_SYNC,
				recordForwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.SAFE_BROWSING_NEXT_BUTTON);
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickSafeBrowsing");
				},
				recordBackwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.BackClickSafeBrowsing");
				},
				isAvailable: () => this.shouldShowSafeBrowsingCard_()
			}],
			[PrivacyGuideStep.COOKIES, {
				nextStep: PrivacyGuideStep.AD_TOPICS,
				recordForwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.COOKIES_NEXT_BUTTON);
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickCookies");
				},
				recordBackwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.BackClickCookies");
				},
				previousStep: PrivacyGuideStep.SAFE_BROWSING,
				isAvailable: () => this.shouldShowCookiesCard_()
			}],
			[PrivacyGuideStep.AD_TOPICS, {
				nextStep: PrivacyGuideStep.COMPLETION,
				recordForwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordPrivacyGuideNextNavigationHistogram(PrivacyGuideInteractions.AD_TOPICS_NEXT_BUTTON);
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.NextClickAdTopics");
				},
				recordBackwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.BackClickAdTopics");
				},
				previousStep: PrivacyGuideStep.COOKIES,
				isAvailable: () => this.shouldShowAdTopicsCard_
			}],
			[PrivacyGuideStep.COMPLETION, {
				recordBackwardNavigationMetrics: () => {
					this.metricsBrowserProxy_.recordAction("Settings.PrivacyGuide.BackClickCompletion");
				},
				previousStep: PrivacyGuideStep.AD_TOPICS,
				isAvailable: () => true
			}]
		]);
	}
	exitIfNecessary() {
		if (!this.isPrivacyGuideAvailable) {
			Router.getInstance().navigateTo(routes.PRIVACY);
			return true;
		}
		return false;
	}
	/** Handler for when the sync state is pushed from the browser. */
	onSyncStatusChanged_(syncStatus) {
		this.syncStatus_ = syncStatus;
		this.navigateForwardIfCurrentCardNoLongerAvailable();
	}
	/** Update the privacy guide state based on changed prefs. */
	onPrefsChanged_() {
		this.navigateForwardIfCurrentCardNoLongerAvailable();
	}
	navigateForwardIfCurrentCardNoLongerAvailable() {
		if (!this.privacyGuideStep_) return;
		if (!this.privacyGuideStepToComponentsMap_.get(this.privacyGuideStep_).isAvailable()) this.navigateForward_();
	}
	/** Sets the privacy guide step from the URL parameter. */
	async updateStateFromQueryParameters_() {
		assert(Router.getInstance().getCurrentRoute() === routes.PRIVACY_GUIDE);
		await CrSettingsPrefs.initialized;
		this.setPrefValue("privacy_guide.viewed", true);
		const step = Router.getInstance().getQueryParameters().get("step");
		if (this.privacyGuideStep_ && step === this.privacyGuideStep_) return;
		if (Object.values(PrivacyGuideStep).includes(step)) this.navigateToCard_(step, false, true);
		else this.navigateToCard_(PrivacyGuideStep.WELCOME, false, true);
	}
	onNextButtonClick_() {
		this.navigateForward_();
	}
	recordEligibleSteps_() {
		for (const key in PrivacyGuideStep) {
			const step = PrivacyGuideStep[key];
			if (step === PrivacyGuideStep.WELCOME) continue;
			const component = this.privacyGuideStepToComponentsMap_.get(step);
			assert(component);
			if (!component.isAvailable()) continue;
			this.metricsBrowserProxy_.recordPrivacyGuideStepsEligibleAndReachedHistogram(eligibilityToRecord(step));
		}
	}
	navigateForward_() {
		const components = this.privacyGuideStepToComponentsMap_.get(this.privacyGuideStep_);
		if (components.isAvailable() && components.recordForwardNavigationMetrics) components.recordForwardNavigationMetrics();
		if (components.nextStep) this.navigateToCard_(components.nextStep, false, false);
	}
	onBackButtonClick_() {
		this.navigateBackward_();
	}
	navigateBackward_() {
		const components = this.privacyGuideStepToComponentsMap_.get(this.privacyGuideStep_);
		if (components.isAvailable() && components.recordBackwardNavigationMetrics) components.recordBackwardNavigationMetrics();
		if (components.previousStep) this.navigateToCard_(components.previousStep, true, false);
	}
	navigateToCard_(step, isBackwardNavigation, isFirstNavigation) {
		assert(step !== this.privacyGuideStep_);
		this.privacyGuideStep_ = step;
		const animateFromLeftToRight = isBackwardNavigation === (loadTimeData$2.getString("textdirection") === "ltr");
		this.translateMultiplier_ = animateFromLeftToRight ? -1 : 1;
		if (!this.privacyGuideStepToComponentsMap_.get(step).isAvailable()) {
			if (isBackwardNavigation) this.navigateBackward_();
			else this.navigateForward_();
		} else {
			if (this.animationsEnabled_) this.$.viewManager.switchView(this.privacyGuideStep_, "no-animation", "fade-out");
			else this.$.viewManager.switchView(this.privacyGuideStep_, "no-animation", "no-animation");
			Router.getInstance().updateRouteParams(new URLSearchParams("step=" + step));
			if (isFirstNavigation) return;
			const elementToFocus = this.shadowRoot.querySelector("#" + this.privacyGuideStep_);
			assert(elementToFocus);
			afterNextRender(this, () => elementToFocus.focus());
		}
	}
	computeBackButtonClass_() {
		if (!this.privacyGuideStep_) return "";
		return this.privacyGuideStepToComponentsMap_.get(this.privacyGuideStep_).previousStep === void 0 ? "visibility-hidden" : "";
	}
	computeStepIndicatorModel() {
		let stepCount = 0;
		let activeIndex = 0;
		for (const step of Object.values(PrivacyGuideStep)) {
			if (step === PrivacyGuideStep.WELCOME || step === PrivacyGuideStep.COMPLETION) continue;
			if (this.privacyGuideStepToComponentsMap_.get(step).isAvailable()) {
				if (step === this.privacyGuideStep_) activeIndex = stepCount;
				++stepCount;
			}
		}
		return {
			active: activeIndex,
			total: stepCount
		};
	}
	shouldShowHistorySyncCard_() {
		assert(this.syncStatus_);
		if (this.syncStatus_.hasError) return false;
		return this.syncStatus_.signedInState === SignedInState.SYNCING || loadTimeData$2.getBoolean("replaceSyncPromosWithSignInPromos") && this.syncStatus_.signedInState === SignedInState.SIGNED_IN;
	}
	shouldShowCookiesCard_() {
		if (!this.prefs) return true;
		return this.getPref("generated.cookie_default_content_setting").value !== ContentSetting.BLOCK;
	}
	shouldShowSafeBrowsingCard_() {
		if (!this.prefs) return true;
		const currentSafeBrowsingSetting = this.getPref("generated.safe_browsing").value;
		return currentSafeBrowsingSetting === SafeBrowsingSetting.ENHANCED || currentSafeBrowsingSetting === SafeBrowsingSetting.STANDARD;
	}
	showAnySettingFragment_() {
		return this.privacyGuideStep_ !== PrivacyGuideStep.WELCOME && this.privacyGuideStep_ !== PrivacyGuideStep.COMPLETION;
	}
	onKeyDown_(event) {
		const isLtr = loadTimeData$2.getString("textdirection") === "ltr";
		switch (event.key) {
			case "ArrowLeft":
				isLtr ? this.navigateBackward_() : this.navigateForward_();
				break;
			case "ArrowRight": isLtr ? this.navigateForward_() : this.navigateBackward_();
		}
	}
};
customElements.define(SettingsPrivacyGuidePageElement.is, SettingsPrivacyGuidePageElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_dialog.html.js
function getTemplate$4() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">#headerLine{margin:8px}#backToSettingsButton{margin-inline-end:10px;margin-inline-start:-10px}#dialog{background-color:var(--cr-card-background-color);border:0;height:100vh;margin:0;max-height:100vh;max-width:100vw;padding:0;width:100vw}#dialog[open]{display:block}settings-privacy-guide-page::part(privacyGuideCard){background-color:transparent;box-shadow:none;margin:auto;max-width:680px;min-width:550px}</style>
<dialog id="dialog" on-cancel="onDialogCancel_" on-close="onDialogClose_"
    aria-label="$i18n{privacyGuideLabel}">
  <div class="cr-row first" id="headerLine" slot="title">
    <cr-icon-button class="icon-arrow-back" id="backToSettingsButton"
        on-click="onSettingsBackClick_"
        aria-label="$i18n{privacyGuideBackToSettingsAriaLabel}"
        aria-roledescription=
        "$i18n{privacyGuideBackToSettingsAriaRoleDescription}">
    </cr-icon-button>
    <h1 class="cr-title-text">$i18n{privacyGuideLabel}</h1>
  </div>
  <settings-privacy-guide-page on-close="onPrivacyGuidePageClose_"
      prefs="{{prefs}}" slot="body">
  </settings-privacy-guide-page>
</dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/privacy_page/privacy_guide/privacy_guide_dialog.js
var SettingsPrivacyGuideDialogElement = class extends PolymerElement {
	static get is() {
		return "settings-privacy-guide-dialog";
	}
	static get template() {
		return getTemplate$4();
	}
	static get properties() {
		return { 
		/**
		* Preferences state.
		*/
prefs: {
			type: Object,
			notify: true
		} };
	}
	connectedCallback() {
		super.connectedCallback();
		this.$.dialog.showModal();
		const elementToFocus = this.shadowRoot.querySelector("#backToSettingsButton");
		afterNextRender(this, () => elementToFocus.focus());
	}
	onDialogCancel_(e) {
		if (e.target === this.$.dialog) e.preventDefault();
	}
	onDialogClose_(e) {
		if (e.target !== this.$.dialog) return;
		this.dispatchEvent(new CustomEvent("close", {
			bubbles: true,
			composed: true
		}));
	}
	onPrivacyGuidePageClose_(e) {
		e.stopPropagation();
		this.$.dialog.close();
	}
	onSettingsBackClick_(e) {
		e.stopPropagation();
		this.$.dialog.close();
	}
};
customElements.define(SettingsPrivacyGuideDialogElement.is, SettingsPrivacyGuideDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/reset_page/reset_browser_proxy.js
var ResetBrowserProxyImpl = class ResetBrowserProxyImpl {
	performResetProfileSettings(sendSettings, requestOrigin) {
		return sendWithPromise("performResetProfileSettings", sendSettings, requestOrigin);
	}
	onHideResetProfileDialog() {
		chrome.send("onHideResetProfileDialog");
	}
	onHideResetProfileBanner() {
		chrome.send("onHideResetProfileBanner");
	}
	onShowResetProfileDialog() {
		chrome.send("onShowResetProfileDialog");
	}
	showReportedSettings() {
		sendWithPromise("getReportedSettings").then(function(settings) {
			const output = settings.map(function(entry) {
				return entry.key + ": " + entry.value.replace(/\n/g, ", ");
			});
			const win = window.open("about:blank");
			const div = win.document.createElement("div");
			div.textContent = output.join("\n");
			div.style.whiteSpace = "pre";
			win.document.body.appendChild(div);
		});
	}
	getTriggeredResetToolName() {
		return sendWithPromise("getTriggeredResetToolName");
	}
	getTamperedPreferencePaths() {
		return sendWithPromise("getTamperedPreferencePaths");
	}
	static getInstance() {
		return instance$6 || (instance$6 = new ResetBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$6 = obj;
	}
};
var instance$6 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/search_page/search_engines_browser_proxy.js
/**
* Contains all recorded interactions on the search engines settings page.
*
* These values are persisted to logs. Entries should not be renumbered and
* numeric values should never be reused.
*
* Must be kept in sync with the SettingsSearchEnginesInteractions enum in
* histograms/enums.xml
*/
var SearchEnginesInteractions;
(function(SearchEnginesInteractions) {
	SearchEnginesInteractions[SearchEnginesInteractions["ACTIVATE"] = 0] = "ACTIVATE";
	SearchEnginesInteractions[SearchEnginesInteractions["DEACTIVATE"] = 1] = "DEACTIVATE";
	SearchEnginesInteractions[SearchEnginesInteractions["KEYBOARD_SHORTCUT_TAB"] = 2] = "KEYBOARD_SHORTCUT_TAB";
	SearchEnginesInteractions[SearchEnginesInteractions["KEYBOARD_SHORTCUT_SPACE_OR_TAB"] = 3] = "KEYBOARD_SHORTCUT_SPACE_OR_TAB";
	SearchEnginesInteractions[SearchEnginesInteractions["COUNT"] = 4] = "COUNT";
})(SearchEnginesInteractions || (SearchEnginesInteractions = {}));
/**
* The location from which the search engine choice was made.
*
* Must be kept in sync with the ChoiceMadeLocation enum in
* //components/search_engines/choice_made_location.h
*/
var ChoiceMadeLocation;
(function(ChoiceMadeLocation) {
	ChoiceMadeLocation[ChoiceMadeLocation["SEARCH_SETTINGS"] = 0] = "SEARCH_SETTINGS";
	ChoiceMadeLocation[ChoiceMadeLocation["SEARCH_ENGINE_SETTINGS"] = 1] = "SEARCH_ENGINE_SETTINGS";
	ChoiceMadeLocation[ChoiceMadeLocation["CHOICE_SCREEN"] = 2] = "CHOICE_SCREEN";
	ChoiceMadeLocation[ChoiceMadeLocation["OTHER"] = 3] = "OTHER";
})(ChoiceMadeLocation || (ChoiceMadeLocation = {}));
var SearchEnginesBrowserProxyImpl = class SearchEnginesBrowserProxyImpl {
	setDefaultSearchEngine(modelIndex, choiceMadeLocation, saveGuestChoice) {
		chrome.send("setDefaultSearchEngine", [
			modelIndex,
			choiceMadeLocation,
			saveGuestChoice
		]);
	}
	setIsActiveSearchEngine(modelIndex, isActive) {
		chrome.send("setIsActiveSearchEngine", [modelIndex, isActive]);
		this.recordSearchEnginesPageHistogram(isActive ? SearchEnginesInteractions.ACTIVATE : SearchEnginesInteractions.DEACTIVATE);
	}
	removeSearchEngine(modelIndex) {
		chrome.send("removeSearchEngine", [modelIndex]);
	}
	searchEngineEditStarted(modelIndex) {
		chrome.send("searchEngineEditStarted", [modelIndex]);
	}
	searchEngineEditCancelled() {
		chrome.send("searchEngineEditCancelled");
	}
	searchEngineEditCompleted(searchEngine, keyword, queryUrl, suggestionsUrl) {
		chrome.send("searchEngineEditCompleted", [
			searchEngine,
			keyword,
			queryUrl,
			suggestionsUrl
		]);
	}
	getSearchEnginesList() {
		return sendWithPromise("getSearchEnginesList");
	}
	getSaveGuestChoice() {
		return sendWithPromise("getSaveGuestChoice");
	}
	validateSearchEngineInput(fieldName, fieldValue) {
		return sendWithPromise("validateSearchEngineInput", fieldName, fieldValue);
	}
	recordSearchEnginesPageHistogram(interaction) {
		chrome.metricsPrivate.recordEnumerationValue("Settings.SearchEngines.Interactions", interaction, SearchEnginesInteractions.COUNT);
	}
	static getInstance() {
		return instance$5 || (instance$5 = new SearchEnginesBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$5 = obj;
	}
};
var instance$5 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_logging_info_bullet.html.js
function getTemplate$3() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared">cr-icon{flex-shrink:0}li{column-gap:16px;display:flex;margin:16px 0}</style>
<li>
  <template is="dom-if" if="[[!isLoggingDisabledByPolicy_(pref)]]" restamp>
    <cr-icon icon="settings20:account-box" aria-hidden="true"></cr-icon>
  </template>
  <template is="dom-if" if="[[isLoggingDisabledByPolicy_(pref)]]" restamp>
    <cr-policy-pref-indicator id="policyIndicator" pref="[[pref]]">
    </cr-policy-pref-indicator>
  </template>
  <div class="secondary">[[label_]]</div>
</li><!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/ai_page/ai_logging_info_bullet.js
var SettingsAiLoggingInfoBulletBase = PrefControlMixin(PolymerElement);
var SettingsAiLoggingInfoBullet = class extends SettingsAiLoggingInfoBulletBase {
	static get is() {
		return "settings-ai-logging-info-bullet";
	}
	static get template() {
		return getTemplate$3();
	}
	static get properties() {
		return {
			label_: {
				type: String,
				computed: "computeLabel_(pref.value)"
			},
			loggingManagedDisabledCustomLabel: {
				type: String,
				value: null
			}
		};
	}
	isLoggingDisabledByPolicy_() {
		return this.pref?.value === ModelExecutionEnterprisePolicyValue.ALLOW_WITHOUT_LOGGING || this.pref?.value === ModelExecutionEnterprisePolicyValue.DISABLE;
	}
	computeLabel_() {
		if (!this.isLoggingDisabledByPolicy_()) return loadTimeData$2.getString("aiSubpageSublabelReviewers");
		if (this.loggingManagedDisabledCustomLabel) return this.loggingManagedDisabledCustomLabel;
		return loadTimeData$2.getString("aiSubpageSublabelLoggingManagedDisabled");
	}
};
customElements.define(SettingsAiLoggingInfoBullet.is, SettingsAiLoggingInfoBullet);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/entity_data_manager_proxy.js
var EntityDataManagerProxyImpl = class EntityDataManagerProxyImpl {
	addOrUpdateEntityInstance(entityInstance) {
		return chrome.autofillPrivate.addOrUpdateEntityInstance(entityInstance);
	}
	removeEntityInstance(guid) {
		return chrome.autofillPrivate.removeEntityInstance(guid);
	}
	loadEntityInstances() {
		return chrome.autofillPrivate.loadEntityInstances();
	}
	getEntityInstanceByGuid(guid) {
		return chrome.autofillPrivate.getEntityInstanceByGuid(guid);
	}
	getWritableEntityTypes() {
		return chrome.autofillPrivate.getWritableEntityTypes();
	}
	getAllAttributeTypesForEntityTypeName(entityTypeName) {
		return chrome.autofillPrivate.getAllAttributeTypesForEntityTypeName(entityTypeName);
	}
	getRequiredAttributeTypesForEntityTypeName(entityTypeName) {
		return chrome.autofillPrivate.getRequiredAttributeTypesForEntityTypeName(entityTypeName);
	}
	addEntityInstancesChangedListener(listener) {
		chrome.autofillPrivate.onEntityInstancesChanged.addListener(listener);
	}
	removeEntityInstancesChangedListener(listener) {
		chrome.autofillPrivate.onEntityInstancesChanged.removeListener(listener);
	}
	authenticateUserBeforeViewingEntityData() {
		return chrome.autofillPrivate.authenticateUserBeforeViewingEntityData();
	}
	toggleAutofillAiReauthRequirement() {
		return chrome.autofillPrivate.toggleAutofillAiReauthRequirement();
	}
	getOptInStatus() {
		return chrome.autofillPrivate.getAutofillAiOptInStatus();
	}
	setOptInStatus(optedIn) {
		return chrome.autofillPrivate.setAutofillAiOptInStatus(optedIn);
	}
	getWalletablePassDetectionOptInStatus() {
		return chrome.autofillPrivate.getWalletablePassDetectionOptInStatus();
	}
	setWalletablePassDetectionOptInStatus(optedIn) {
		return chrome.autofillPrivate.setWalletablePassDetectionOptInStatus(optedIn);
	}
	static getInstance() {
		return instance$4 || (instance$4 = new EntityDataManagerProxyImpl());
	}
	static setInstance(obj) {
		instance$4 = obj;
	}
};
var instance$4 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/mojo/public/js/bindings.js
var mojo = {
	internal: { interfaceSupport: {} },
	interfaceControl: {},
	pipeControl: {}
};
mojo.internal.kArrayHeaderSize = 8, mojo.internal.kStructHeaderSize = 8, mojo.internal.kStructHeaderSizeOffset = 0, mojo.internal.kStructHeaderVersionOffset = 4, mojo.internal.kUnionHeaderSize = 8, mojo.internal.kUnionDataSize = 16, mojo.internal.kMessageV0HeaderSize = 24, mojo.internal.kMessageV1HeaderSize = 32, mojo.internal.kMessageV2HeaderSize = 48, mojo.internal.kMapDataSize = 24, mojo.internal.kEncodedInvalidHandleValue = 4294967295, mojo.internal.kMessageFlagExpectsResponse = 1, mojo.internal.kMessageFlagIsResponse = 2, mojo.internal.kInterfaceNamespaceBit = 2147483648, mojo.internal.kHostLittleEndian = !!new Uint8Array(new Uint16Array([1]).buffer)[0], mojo.internal.isNullOrUndefined = function(e) {
	return null == e;
}, mojo.internal.isNullableValueKindField = function(e) {
	return void 0 !== e.nullableValueKindProperties;
}, mojo.internal.align = function(e, n) {
	return e + (n - e % n) % n;
}, mojo.internal.setInt64 = function(e, n, t) {
	mojo.internal.kHostLittleEndian ? (e.setUint32(n, Number(BigInt(t) & BigInt(4294967295)), mojo.internal.kHostLittleEndian), e.setInt32(n + 4, Number(BigInt(t) >> BigInt(32) & BigInt(4294967295)), mojo.internal.kHostLittleEndian)) : (e.setInt32(n, Number(BigInt(t) >> BigInt(32) & BigInt(4294967295)), mojo.internal.kHostLittleEndian), e.setUint32(n + 4, Number(BigInt(t) & BigInt(4294967295)), mojo.internal.kHostLittleEndian));
}, mojo.internal.setUint64 = function(e, n, t) {
	mojo.internal.kHostLittleEndian ? (e.setUint32(n, Number(BigInt(t) & BigInt(4294967295)), mojo.internal.kHostLittleEndian), e.setUint32(n + 4, Number(BigInt(t) >> BigInt(32) & BigInt(4294967295)), mojo.internal.kHostLittleEndian)) : (e.setUint32(n, Number(BigInt(t) >> BigInt(32) & BigInt(4294967295)), mojo.internal.kHostLittleEndian), e.setUint32(n + 4, Number(BigInt(t) & BigInt(4294967295)), mojo.internal.kHostLittleEndian));
}, mojo.internal.getInt64 = function(e, n) {
	let t, o;
	return mojo.internal.kHostLittleEndian ? (t = e.getUint32(n, mojo.internal.kHostLittleEndian), o = e.getInt32(n + 4, mojo.internal.kHostLittleEndian)) : (t = e.getUint32(n + 4, mojo.internal.kHostLittleEndian), o = e.getInt32(n, mojo.internal.kHostLittleEndian)), BigInt(o) << BigInt(32) | BigInt(t);
}, mojo.internal.getUint64 = function(e, n) {
	let t, o;
	return mojo.internal.kHostLittleEndian ? (t = e.getUint32(n, mojo.internal.kHostLittleEndian), o = e.getUint32(n + 4, mojo.internal.kHostLittleEndian)) : (t = e.getUint32(n + 4, mojo.internal.kHostLittleEndian), o = e.getUint32(n, mojo.internal.kHostLittleEndian)), BigInt(o) << BigInt(32) | BigInt(t);
}, mojo.internal.MessageDimensions, mojo.internal.getMojoFieldValue = function(e, n) {
	if (n.fieldGetter) return n.fieldGetter(e);
	if (e && mojo.internal.isNullableValueKindField(n)) {
		const t = n.nullableValueKindProperties, o = !mojo.internal.isNullOrUndefined(e[t.originalFieldName]);
		return t.isPrimary ? o : o ? e[t.originalFieldName] : n.defaultValue;
	}
	return e[n.name];
}, mojo.internal.computeStructDimensions = function(e, n) {
	let t = e.packedSize, o = 0;
	for (const i of e.fields) {
		let e = mojo.internal.getMojoFieldValue(n, i);
		if (mojo.internal.isNullOrUndefined(e) && (e = i.defaultValue), null !== e) if (i.type.$.computeDimensions) {
			const n = i.type.$.computeDimensions(e, i.nullable);
			t += mojo.internal.align(n.size, 8), n.numInterfaceIds && (o += n.numInterfaceIds);
		} else i.type.$.hasInterfaceId && o++;
	}
	return {
		size: t,
		numInterfaceIds: o
	};
}, mojo.internal.computeUnionDimensions = function(e, n, t) {
	let o = n ? mojo.internal.kUnionDataSize : 0, i = 0;
	const r = Object.keys(t);
	if (1 !== r.length) throw new Error(`Value for ${e.name} must be an Object with a single property named one of: ` + Object.keys(e.fields).join(","));
	const s = r[0], a = e.fields[s], l = t[s];
	if (!mojo.internal.isNullOrUndefined(l)) if (a.type.$.computeDimensions) {
		const e = !!a.type.$.unionSpec || a.nullable, n = a.type.$.computeDimensions(l, e);
		o += mojo.internal.align(n.size, 8), n.numInterfaceIds && (i += n.numInterfaceIds);
	} else a.type.$.hasInterfaceId && i++;
	return {
		size: o,
		numInterfaceIds: i
	};
}, mojo.internal.computeInlineArraySize = function(e, n) {
	return e.elementType === mojo.internal.Bool ? mojo.internal.kArrayHeaderSize + mojo.internal.computeHasValueBitfieldSize(e, n.length) + (n.length + 7 >> 3) : mojo.internal.kArrayHeaderSize + mojo.internal.computeHasValueBitfieldSize(e, n.length) + n.length * e.elementType.$.arrayElementSize(!!e.elementNullable);
}, mojo.internal.computeHasValueBitfieldSize = function(e, n) {
	if (!(!!e.elementNullable && !!e.elementType.$.isValueType)) return 0;
	const t = e.elementType.$.arrayElementSize(!0), o = 8 * t;
	return ((n + o - 1) / o | 0) * t;
}, mojo.internal.computeTotalArraySize = function(e, n) {
	const t = mojo.internal.computeInlineArraySize(e, n);
	if (!e.elementType.$.computeDimensions) return t;
	let o = t;
	for (let t of n) mojo.internal.isNullOrUndefined(t) || (o += mojo.internal.align(e.elementType.$.computeDimensions(t, !!e.elementNullable).size, 8));
	return o;
}, mojo.internal.Message = class {
	constructor(e, n, t, o, i, r, s) {
		const a = mojo.internal.computeStructDimensions(r, s);
		let l, c;
		a.numInterfaceIds > 0 ? (l = mojo.internal.kMessageV2HeaderSize, c = 2) : t & (mojo.internal.kMessageFlagExpectsResponse | mojo.internal.kMessageFlagIsResponse) ? (l = mojo.internal.kMessageV1HeaderSize, c = 1) : (l = mojo.internal.kMessageV0HeaderSize, c = 0);
		const d = l + a.size, u = a.numInterfaceIds > 0 ? mojo.internal.kArrayHeaderSize + 4 * a.numInterfaceIds : 0, p = d + mojo.internal.align(u, 8);
		this.buffer = new ArrayBuffer(p), this.handles = [];
		const m = new DataView(this.buffer);
		m.setUint32(0, l, mojo.internal.kHostLittleEndian), m.setUint32(4, c, mojo.internal.kHostLittleEndian), m.setUint32(8, n, mojo.internal.kHostLittleEndian), m.setUint32(12, o, mojo.internal.kHostLittleEndian), m.setUint32(16, t, mojo.internal.kHostLittleEndian), m.setUint32(20, 0), c >= 1 && (mojo.internal.setUint64(m, 24, i), c >= 2 && (mojo.internal.setUint64(m, 32, BigInt(16)), mojo.internal.setUint64(m, 40, BigInt(d - 40)), m.setUint32(d, u, mojo.internal.kHostLittleEndian), m.setUint32(d + 4, a.numInterfaceIds || 0, mojo.internal.kHostLittleEndian))), this.nextInterfaceIdIndex_ = 0, this.interfaceIds_ = null, a.numInterfaceIds && (this.interfaceIds_ = new Uint32Array(this.buffer, d + mojo.internal.kArrayHeaderSize, a.numInterfaceIds)), this.nextAllocationOffset_ = l;
		const f = this.allocate(r.packedSize);
		new mojo.internal.Encoder(this, f, { endpoint: e }).encodeStructInline(r, s);
	}
	allocate(e) {
		const n = mojo.internal.align(e, 8), t = new DataView(this.buffer, this.nextAllocationOffset_, n);
		return this.nextAllocationOffset_ += n, t;
	}
}, mojo.internal.MessageContext, mojo.internal.Encoder = class {
	constructor(e, n, t = null) {
		this.context_ = t, this.message_ = e, this.data_ = n;
	}
	encodeBool(e, n, t) {
		const o = this.data_.getUint8(e);
		t ? this.data_.setUint8(e, o | 1 << n) : this.data_.setUint8(e, o & ~(1 << n));
	}
	encodeInt8(e, n) {
		this.data_.setInt8(e, n);
	}
	encodeUint8(e, n) {
		this.data_.setUint8(e, n);
	}
	encodeInt16(e, n) {
		this.data_.setInt16(e, n, mojo.internal.kHostLittleEndian);
	}
	encodeUint16(e, n) {
		this.data_.setUint16(e, n, mojo.internal.kHostLittleEndian);
	}
	encodeInt32(e, n) {
		this.data_.setInt32(e, n, mojo.internal.kHostLittleEndian);
	}
	encodeUint32(e, n) {
		this.data_.setUint32(e, n, mojo.internal.kHostLittleEndian);
	}
	encodeInt64(e, n) {
		mojo.internal.setInt64(this.data_, e, n);
	}
	encodeUint64(e, n) {
		mojo.internal.setUint64(this.data_, e, n);
	}
	encodeFloat(e, n) {
		this.data_.setFloat32(e, n, mojo.internal.kHostLittleEndian);
	}
	encodeDouble(e, n) {
		this.data_.setFloat64(e, n, mojo.internal.kHostLittleEndian);
	}
	encodeHandle(e, n) {
		this.encodeUint32(e, this.message_.handles.length), this.message_.handles.push(n);
	}
	encodeAssociatedEndpoint(e, n) {
		console.assert(n.isPendingAssociation, "expected unbound associated endpoint");
		const t = this.context_.endpoint.associatePeerOfOutgoingEndpoint(n), o = this.message_.nextInterfaceIdIndex_++;
		this.encodeUint32(e, o), this.message_.interfaceIds_[o] = t;
	}
	encodeString(e, n) {
		if ("string" != typeof n) throw new Error("Unxpected non-string value for string field.");
		this.encodeArray({ elementType: mojo.internal.Uint8 }, e, mojo.internal.Encoder.stringToUtf8Bytes(n));
	}
	encodeOffset(e, n) {
		this.encodeUint64(e, n - this.data_.byteOffset - e);
	}
	encodeArray(e, n, t) {
		const o = mojo.internal.computeInlineArraySize(e, t), i = this.message_.allocate(o), r = new mojo.internal.Encoder(this.message_, i, this.context_);
		this.encodeOffset(n, i.byteOffset), r.encodeUint32(0, o), r.encodeUint32(4, t.length), this.maybeEncodeHasValueBitfield(e, r, 8, t);
		let s = 8 + mojo.internal.computeHasValueBitfieldSize(e, t.length);
		if (e.elementType === mojo.internal.Bool) {
			let e = 0;
			for (const n of t) r.encodeBool(s, e, n), e++, 8 == e && (e = 0, s++);
		} else for (const n of t) {
			if (null === n) {
				if (!e.elementNullable) throw new Error("Trying to send a null element in an array of non-nullable elements");
				e.elementType.$.encodeNull(r, s);
			} else e.elementType.$.encode(n, r, s, 0, !!e.elementNullable);
			s += e.elementType.$.arrayElementSize(!!e.elementNullable);
		}
	}
	maybeEncodeHasValueBitfield(e, n, t, o) {
		if (!e.elementNullable || !e.elementType.$.isValueType) return;
		let i = 0, r = t;
		for (const e of o) null == e ? n.encodeBool(r, i, !1) : n.encodeBool(r, i, !0), i++, 8 == i && (i = 0, r++);
	}
	encodeMap(e, n, t) {
		let o, i;
		"Map" == t.constructor.name ? (o = Array.from(t.keys()), i = Array.from(t.values())) : (o = Object.keys(t), i = o.map(((e) => t[e])));
		const r = this.message_.allocate(mojo.internal.kMapDataSize), s = new mojo.internal.Encoder(this.message_, r, this.context_);
		this.encodeOffset(n, r.byteOffset), s.encodeUint32(0, mojo.internal.kMapDataSize), s.encodeUint32(4, 0), s.encodeArray({ elementType: e.keyType }, 8, o), s.encodeArray({
			elementType: e.valueType,
			elementNullable: e.valueNullable
		}, 16, i);
	}
	encodeStruct(e, n, t) {
		const o = this.message_.allocate(e.packedSize), i = new mojo.internal.Encoder(this.message_, o, this.context_);
		this.encodeOffset(n, o.byteOffset), i.encodeStructInline(e, t);
	}
	encodeStructInline(e, n) {
		const t = e.versions;
		this.encodeUint32(0, e.packedSize), this.encodeUint32(4, t[t.length - 1].version);
		for (const t of e.fields) {
			const o = mojo.internal.kStructHeaderSize + t.packedOffset, i = (e) => {
				t.type.$.encode(e, this, o, t.packedBitOffset, t.nullable);
			}, r = mojo.internal.isNullOrUndefined(n) ? void 0 : mojo.internal.getMojoFieldValue(n, t);
			if (mojo.internal.isNullOrUndefined(n) || mojo.internal.isNullOrUndefined(r)) if (null === t.defaultValue) {
				if (!t.nullable) throw new Error(e.name + " missing value for non-nullable field \"" + t.name + `", got: "${r}"...`);
				t.type.$.encodeNull(this, o);
			} else i(t.defaultValue);
			else i(r);
		}
	}
	encodeUnionAsPointer(e, n, t) {
		const o = this.message_.allocate(mojo.internal.kUnionDataSize), i = new mojo.internal.Encoder(this.message_, o, this.context_);
		this.encodeOffset(n, o.byteOffset), i.encodeUnion(e, 0, t);
	}
	encodeUnion(e, n, t) {
		const o = Object.keys(t);
		if (1 !== o.length) throw new Error(`Value for ${e.name} must be an Object with a single property named one of: ` + Object.keys(e.fields).join(","));
		const i = o[0], r = e.fields[i];
		this.encodeUint32(n, mojo.internal.kUnionDataSize), this.encodeUint32(n + 4, r.ordinal);
		const s = n + mojo.internal.kUnionHeaderSize;
		void 0 === r.type.$.unionSpec ? r.type.$.encode(t[i], this, s, 0, r.nullable) : this.encodeUnionAsPointer(r.type.$.unionSpec, s, t[i]);
	}
	static stringToUtf8Bytes(e) {
		return mojo.internal.Encoder.textEncoder || (mojo.internal.Encoder.textEncoder = new TextEncoder("utf-8")), mojo.internal.Encoder.textEncoder.encode(e);
	}
}, mojo.internal.Encoder.textEncoder = null, mojo.internal.Decoder = class {
	constructor(e, n, t = null) {
		this.context_ = t, this.data_ = e, this.handles_ = n;
	}
	decodeBool(e, n) {
		return !!(this.data_.getUint8(e) & 1 << n);
	}
	decodeInt8(e) {
		return this.data_.getInt8(e);
	}
	decodeUint8(e) {
		return this.data_.getUint8(e);
	}
	decodeInt16(e) {
		return this.data_.getInt16(e, mojo.internal.kHostLittleEndian);
	}
	decodeUint16(e) {
		return this.data_.getUint16(e, mojo.internal.kHostLittleEndian);
	}
	decodeInt32(e) {
		return this.data_.getInt32(e, mojo.internal.kHostLittleEndian);
	}
	decodeUint32(e) {
		return this.data_.getUint32(e, mojo.internal.kHostLittleEndian);
	}
	decodeInt64(e) {
		return mojo.internal.getInt64(this.data_, e);
	}
	decodeUint64(e) {
		return mojo.internal.getUint64(this.data_, e);
	}
	decodeFloat(e) {
		return this.data_.getFloat32(e, mojo.internal.kHostLittleEndian);
	}
	decodeDouble(e) {
		return this.data_.getFloat64(e, mojo.internal.kHostLittleEndian);
	}
	decodeHandle(e) {
		const n = this.data_.getUint32(e, mojo.internal.kHostLittleEndian);
		if (4294967295 == n) return null;
		if (n >= this.handles_.length) throw new Error("Decoded invalid handle index");
		return this.handles_[n];
	}
	decodeString(e) {
		const n = this.decodeArray({ elementType: mojo.internal.Uint8 }, e);
		return n ? (mojo.internal.Decoder.textDecoder || (mojo.internal.Decoder.textDecoder = new TextDecoder("utf-8")), mojo.internal.Decoder.textDecoder.decode(new Uint8Array(n).buffer)) : null;
	}
	decodeOffset(e) {
		const n = this.decodeUint64(e);
		if (0 == n) return 0;
		if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Mesage offset too large");
		return this.data_.byteOffset + e + Number(n);
	}
	decodeArray(e, n) {
		const t = this.decodeOffset(n);
		if (!t) return null;
		const o = new mojo.internal.Decoder(new DataView(this.data_.buffer, t), this.handles_, this.context_), i = o.decodeUint32(4);
		if (!i) return [];
		const r = !!e.elementNullable && e.elementType.$.isValueType, s = r ? [] : null;
		if (r) {
			let e = 8, n = 0;
			for (let t = 0; t < i; ++t) s.push(o.decodeBool(e, n)), n++, 8 === n && (n = 0, e++);
		}
		let a = 8 + mojo.internal.computeHasValueBitfieldSize(e, i);
		const l = [];
		if (e.elementType === mojo.internal.Bool) for (let e = 0; e < i; ++e) r && !s[e] ? l.push(null) : l.push(o.decodeBool(a + (e >> 3), e % 8));
		else for (let n = 0; n < i; ++n) {
			if (r && !s[n]) l.push(null);
			else {
				const n = e.elementType.$.decode(o, a, 0, !!e.elementNullable);
				if (null === n && !e.elementNullable) throw new Error("Received unexpected array element");
				l.push(n);
			}
			a += e.elementType.$.arrayElementSize(!!e.elementNullable);
		}
		return l;
	}
	decodeMap(e, n) {
		const t = this.decodeOffset(n);
		if (!t) return null;
		const o = new mojo.internal.Decoder(new DataView(this.data_.buffer, t), this.handles_, this.context_), i = o.decodeUint32(0), r = o.decodeUint32(4);
		if (i != mojo.internal.kMapDataSize || 0 != r) throw new Error("Received invalid map data");
		const s = o.decodeArray({ elementType: e.keyType }, 8), a = o.decodeArray({
			elementType: e.valueType,
			elementNullable: e.valueNullable
		}, 16);
		if (s.length != a.length) throw new Error("Received invalid map data");
		if (!e.keyType.$.isValidObjectKeyType) {
			const e = /* @__PURE__ */ new Map();
			for (let n = 0; n < s.length; ++n) e.set(s[n], a[n]);
			return e;
		}
		const l = {};
		for (let e = 0; e < s.length; ++e) l[s[e]] = a[e];
		return l;
	}
	decodeStruct(e, n) {
		const t = this.decodeOffset(n);
		if (!t) return null;
		return new mojo.internal.Decoder(new DataView(this.data_.buffer, t), this.handles_, this.context_).decodeStructInline(e);
	}
	isStructHeaderValid(e, n, t) {
		const o = e.versions;
		for (let e = o.length - 1; e >= 0; --e) {
			const i = o[e];
			if (t > i.version) return n >= i.packedSize;
			if (t == i.version) return n == i.packedSize;
		}
		throw new Error(`Impossible version ${t} for struct ${e.name}`);
	}
	wrapStructInDataView(e, n, t) {
		const o = this.decodeOffset(n);
		if (!o) return null;
		const i = new mojo.internal.Decoder(new DataView(this.data_.buffer, o), this.handles_, this.context_), r = i.decodeUint32(mojo.internal.kStructHeaderSizeOffset), s = i.decodeUint32(mojo.internal.kStructHeaderVersionOffset);
		if (!i.isStructHeaderValid(e, r, s)) throw new Error(`Received ${e.name} of invalid size (${r}) and/or version (${s})`);
		return new t(i, s, e.fields);
	}
	decodeStructInline(e) {
		const n = this.decodeUint32(mojo.internal.kStructHeaderSizeOffset), t = this.decodeUint32(mojo.internal.kStructHeaderVersionOffset);
		if (!this.isStructHeaderValid(e, n, t)) throw new Error(`Received ${e.name} of invalid size (${n}) and/or version (${t})`);
		const o = {};
		for (let n = 0; n < e.fields.length; ++n) {
			const i = e.fields[n];
			if (mojo.internal.isNullableValueKindField(i)) {
				const n = i.nullableValueKindProperties;
				if (!n.isPrimary) continue;
				{
					const r = i;
					o[n.originalFieldName] = this.decodeStructNullableValueField(r, e.fields, t);
				}
			} else o[i.name] = this.decodeStructField(i, t);
		}
		return o;
	}
	decodeStructField(e, n) {
		return e.minVersion > n ? e.defaultValue : ((e) => {
			const n = mojo.internal.kStructHeaderSize + e.packedOffset, t = e.type.$.decode(this, n, e.packedBitOffset, !!e.nullable);
			if (null === t && !e.nullable) throw new Error(`Received ${e.name} with invalid null field "${e.name}"`);
			return t;
		})(e);
	}
	decodeStructNullableValueField(e, n, t) {
		if (e.minVersion > t) return null;
		if (!this.decodeStructField(e, t)) return null;
		const o = e.nullableValueKindProperties, i = n.find(((e) => e.name === o.linkedValueFieldName));
		if (!i) throw new Error("could not find the expected value field spec: " + o.linkedValueFieldName);
		return this.decodeStructField(i, t);
	}
	decodeUnionFromPointer(e, n) {
		const t = this.decodeOffset(n);
		if (!t) return null;
		return new mojo.internal.Decoder(new DataView(this.data_.buffer, t), this.handles_, this.context_).decodeUnion(e, 0);
	}
	decodeUnion(e, n) {
		if (0 === this.decodeUint32(n)) return null;
		const t = this.decodeUint32(n + 4);
		for (const o in e.fields) {
			const i = e.fields[o];
			if (i.ordinal === t) {
				const t = (() => {
					const e = n + mojo.internal.kUnionHeaderSize;
					return void 0 !== i.type.$.unionSpec ? this.decodeUnionFromPointer(i.type.$.unionSpec, e) : i.type.$.decode(this, e, 0, i.nullable);
				})();
				if (null === t && !i.nullable) throw new Error(`Received ${e.name} with invalid null field: ${i.name}`);
				const r = {};
				return r[o] = t, r;
			}
		}
	}
	decodeInterfaceProxy(e, n) {
		const t = this.decodeHandle(n);
		return t ? new e(t) : null;
	}
	decodeInterfaceRequest(e, n) {
		const t = this.decodeHandle(n);
		return t ? new e(mojo.internal.interfaceSupport.createEndpoint(t)) : null;
	}
	decodeAssociatedEndpoint(e) {
		if (!this.context_ || !this.context_.endpoint) throw new Error("cannot deserialize associated endpoint without context");
		const n = this.context_.endpoint, t = new DataView(this.data_.buffer), o = Number(mojo.internal.getUint64(t, 40)), i = t.getUint32(o + 44, mojo.internal.kHostLittleEndian), r = new Uint32Array(t.buffer, o + mojo.internal.kArrayHeaderSize + 40, i)[this.decodeUint32(e)], s = new mojo.internal.interfaceSupport.Endpoint(n.router, r);
		return n.router.addEndpoint(s, r), s;
	}
}, mojo.internal.Decoder.textDecoder = null, mojo.internal.MessageHeader, mojo.internal.deserializeMessageHeader = function(e) {
	const n = e.getUint32(0, mojo.internal.kHostLittleEndian), t = e.getUint32(4, mojo.internal.kHostLittleEndian);
	if (0 == t && n != mojo.internal.kMessageV0HeaderSize || 1 == t && n != mojo.internal.kMessageV1HeaderSize || t >= 2 && n < mojo.internal.kMessageV2HeaderSize) throw new Error("Received invalid message header");
	return {
		headerSize: n,
		headerVersion: t,
		interfaceId: e.getUint32(8, mojo.internal.kHostLittleEndian),
		ordinal: e.getUint32(12, mojo.internal.kHostLittleEndian),
		flags: e.getUint32(16, mojo.internal.kHostLittleEndian),
		requestId: t < 1 ? 0 : e.getUint32(24, mojo.internal.kHostLittleEndian)
	};
}, mojo.internal.MojomTypeInfo, mojo.internal.MojomType, mojo.internal.ArraySpec, mojo.internal.MapSpec, mojo.internal.NullableValueKindProperties = class {
	constructor() {
		this.isPrimary, this.linkedValueFieldName, this.originalFieldName;
	}
}, mojo.internal.StructFieldSpec, mojo.internal.StructVersionInfo, mojo.internal.StructSpec, mojo.internal.UnionFieldSpec, mojo.internal.UnionSpec, mojo.internal.Bool = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeBool(t, o, e);
	},
	encodeNull: function(e, n) {
		throw new Error("encoding bool null from type is not implemented");
	},
	decode: function(e, n, t, o) {
		return e.decodeBool(n, t);
	},
	arrayElementSize: (e) => 1,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Int8 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeInt8(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeInt8(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeInt8(n);
	},
	arrayElementSize: (e) => 1,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Uint8 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeUint8(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeUint8(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeUint8(n);
	},
	arrayElementSize: (e) => 1,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Int16 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeInt16(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeInt16(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeInt16(n);
	},
	arrayElementSize: (e) => 2,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Uint16 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeUint16(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeUint16(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeUint16(n);
	},
	arrayElementSize: (e) => 2,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Int32 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeInt32(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeInt32(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeInt32(n);
	},
	arrayElementSize: (e) => 4,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Uint32 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeUint32(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeUint32(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeUint32(n);
	},
	arrayElementSize: (e) => 4,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Int64 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeInt64(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeInt64(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeInt64(n);
	},
	arrayElementSize: (e) => 8,
	isValidObjectKeyType: !1,
	isValueType: !0
} }, mojo.internal.Uint64 = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeUint64(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeUint64(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeUint64(n);
	},
	arrayElementSize: (e) => 8,
	isValidObjectKeyType: !1,
	isValueType: !0
} }, mojo.internal.Float = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeFloat(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeFloat(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeFloat(n);
	},
	arrayElementSize: (e) => 4,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Double = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeDouble(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeDouble(n, 0);
	},
	decode: function(e, n, t, o) {
		return e.decodeDouble(n);
	},
	arrayElementSize: (e) => 8,
	isValidObjectKeyType: !0,
	isValueType: !0
} }, mojo.internal.Handle = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeHandle(t, e);
	},
	encodeNull: function(e, n) {
		e.encodeUint32(n, 4294967295);
	},
	decode: function(e, n, t, o) {
		return e.decodeHandle(n);
	},
	arrayElementSize: (e) => 4,
	isValidObjectKeyType: !1,
	isValueType: !1
} }, mojo.internal.String = { $: {
	encode: function(e, n, t, o, i) {
		n.encodeString(t, e);
	},
	encodeNull: function(e, n) {},
	decode: function(e, n, t, o) {
		return e.decodeString(n);
	},
	computeDimensions: function(e, n) {
		return { size: mojo.internal.computeTotalArraySize({ elementType: mojo.internal.Uint8 }, mojo.internal.Encoder.stringToUtf8Bytes(e)) };
	},
	arrayElementSize: (e) => 8,
	isValidObjectKeyType: !0,
	isValueType: !1
} }, mojo.internal.Array = function(e, n) {
	const t = {
		elementType: e,
		elementNullable: n
	};
	return { $: {
		arraySpec: t,
		encode: function(e, n, o, i, r) {
			n.encodeArray(t, o, e);
		},
		encodeNull: function(e, n) {},
		decode: function(e, n, o, i) {
			return e.decodeArray(t, n);
		},
		computeDimensions: function(e, n) {
			return { size: mojo.internal.computeTotalArraySize(t, e) };
		},
		arrayElementSize: (e) => 8,
		isValidObjectKeyType: !1,
		isValueType: !1
	} };
}, mojo.internal.Map = function(e, n, t) {
	const o = {
		keyType: e,
		valueType: n,
		valueNullable: t
	};
	return { $: {
		mapSpec: o,
		encode: function(e, n, t, i, r) {
			n.encodeMap(o, t, e);
		},
		encodeNull: function(e, n) {},
		decode: function(e, n, t, i) {
			return e.decodeMap(o, n);
		},
		computeDimensions: function(o, i) {
			const r = "Map" == o.constructor.name ? Array.from(o.keys()) : Object.keys(o), s = "Map" == o.constructor.name ? Array.from(o.values()) : r.map(((e) => o[e]));
			return { size: mojo.internal.kMapDataSize + mojo.internal.align(mojo.internal.computeTotalArraySize({ elementType: e }, r), 8) + mojo.internal.computeTotalArraySize({
				elementType: n,
				elementNullable: t
			}, s) };
		},
		arrayElementSize: (e) => 8,
		isValidObjectKeyType: !1,
		isValueType: !1
	} };
}, mojo.internal.Enum = function() {
	return { $: {
		encode: function(e, n, t, o, i) {
			n.encodeUint32(t, e);
		},
		encodeNull: function(e, n) {},
		decode: function(e, n, t, o) {
			return e.decodeInt32(n);
		},
		arrayElementSize: (e) => 4,
		isValidObjectKeyType: !0,
		isValueType: !0
	} };
}, mojo.internal.StructField = function(e, n, t, o, i, r, s = 0, a = void 0, l = void 0) {
	return {
		name: e,
		packedOffset: n,
		packedBitOffset: t,
		type: o,
		defaultValue: i,
		nullable: r,
		minVersion: s,
		nullableValueKindProperties: a,
		fieldGetter: l
	};
}, mojo.internal.Struct = function(e, n, t, o) {
	const i = o.map(((e) => ({
		version: e[0],
		packedSize: e[1]
	}))), r = {
		name: n,
		packedSize: i[i.length - 1].packedSize,
		fields: t,
		versions: i
	};
	e.$ = {
		structSpec: r,
		encode: function(e, n, t, o, i) {
			n.encodeStruct(r, t, e);
		},
		encodeNull: function(e, n) {},
		decode: function(e, n, t, o) {
			return e.decodeStruct(r, n);
		},
		computeDimensions: function(e, n) {
			return mojo.internal.computeStructDimensions(r, e);
		},
		arrayElementSize: (e) => 8,
		isValidObjectKeyType: !1
	};
}, mojo.internal.TypemappedStruct = function(e, n, t, o, i, r) {
	const s = r.map(((e) => ({
		version: e[0],
		packedSize: e[1]
	}))), a = {
		name: n,
		packedSize: s[s.length - 1].packedSize,
		fields: i,
		versions: s
	};
	e.$ = {
		structSpec: a,
		encode: function(e, n, t, o, i) {
			n.encodeStruct(a, t, e);
		},
		encodeNull: function(e, n) {},
		decode: function(e, n, i, r) {
			const s = e.wrapStructInDataView(a, n, t);
			return mojo.internal.isNullOrUndefined(s) ? null : o.convert(s);
		},
		computeDimensions: function(e, n) {
			return mojo.internal.computeStructDimensions(a, e);
		},
		arrayElementSize: (e) => 8,
		isValidObjectKeyType: !1
	};
}, mojo.internal.createStructDeserializer = function(e) {
	return function(n) {
		if (null == e.$ || null == e.$.structSpec) throw new Error("Invalid struct mojom type!");
		return new mojo.internal.Decoder(n, []).decodeStructInline(e.$.structSpec);
	};
}, mojo.internal.Union = function(e, n, t) {
	const o = {
		name: n,
		fields: t
	};
	e.$ = {
		unionSpec: o,
		encode: function(e, n, t, i, r) {
			n.encodeUnion(o, t, e);
		},
		encodeNull: function(e, n) {},
		decode: function(e, n, t, i) {
			return e.decodeUnion(o, n);
		},
		computeDimensions: function(e, n) {
			return mojo.internal.computeUnionDimensions(o, n, e);
		},
		arrayElementSize: (e) => e ? 8 : 16,
		isValidObjectKeyType: !1
	};
}, mojo.internal.InterfaceProxy = function(e) {
	return { $: {
		encode: function(n, t, o, i, r) {
			const s = n.proxy.unbind();
			console.assert(s, `unexpected null ${e.name}`);
			const a = s.releasePipe();
			t.encodeHandle(o, a), t.encodeUint32(o + 4, 0);
		},
		encodeNull: function(e, n) {
			e.encodeUint32(n, 4294967295);
		},
		decode: function(n, t, o, i) {
			return n.decodeInterfaceProxy(e, t);
		},
		arrayElementSize: (e) => 8,
		isValidObjectKeyType: !1,
		isValueType: !1
	} };
}, mojo.internal.InterfaceRequest = function(e) {
	return { $: {
		encode: function(n, t, o, i, r) {
			if (!n.handle) throw new Error("Unexpected null " + e.name);
			t.encodeHandle(o, n.handle.releasePipe());
		},
		encodeNull: function(e, n) {
			e.encodeUint32(n, 4294967295);
		},
		decode: function(n, t, o, i) {
			return n.decodeInterfaceRequest(e, t);
		},
		arrayElementSize: (e) => 8,
		isValidObjectKeyType: !1,
		isValueType: !1
	} };
}, mojo.internal.AssociatedInterfaceProxy = function(e) {
	return { $: {
		type: e,
		encode: function(n, t, o, i, r) {
			console.assert(n.proxy.endpoint && n.proxy.endpoint.isPendingAssociation, `expected ${e.name} to be associated and unbound`), t.encodeAssociatedEndpoint(o, n.proxy.endpoint), t.encodeUint32(o + 4, 0);
		},
		encodeNull: function(e, n) {
			e.encodeUint32(n, 4294967295), e.encodeUint32(n + 4, 0);
		},
		decode: function(n, t, o, i) {
			return new e(n.decodeAssociatedEndpoint(t));
		},
		arrayElementSize: (e) => {
			throw new Error("Arrays of associated endpoints are not yet supported");
		},
		isValidObjectKeyType: !1,
		hasInterfaceId: !0,
		isValueType: !1
	} };
}, mojo.internal.AssociatedInterfaceRequest = function(e) {
	return { $: {
		type: e,
		encode: function(n, t, o, i, r) {
			console.assert(n.handle && n.handle.isPendingAssociation, `expected ${e.name} to be associated and unbound`), t.encodeAssociatedEndpoint(o, n.handle);
		},
		encodeNull: function(e, n) {
			e.encodeUint32(n, 4294967295);
		},
		decode: function(n, t, o, i) {
			return new e(n.decodeAssociatedEndpoint(t));
		},
		arrayElementSize: (e) => {
			throw new Error("Arrays of associated endpoints are not yet supported");
		},
		isValidObjectKeyType: !1,
		hasInterfaceId: !0,
		isValueType: !1
	} };
}, mojo.internal.decodeStructField = function(e, n, t) {
	return e.decodeStructField(n, t);
}, mojo.internal.decodeStructNullableValueField = function(e, n, t, o) {
	n.nullableValueKindProperties.linkedValueFieldName;
	return e.decodeStructNullableValueField(n, t, o);
}, mojo.interfaceControl.RUN_MESSAGE_ID = 4294967295, mojo.interfaceControl.RUN_OR_CLOSE_PIPE_MESSAGE_ID = 4294967294, mojo.interfaceControl.RunMessageParamsSpec = { $: {} }, mojo.interfaceControl.RunResponseMessageParamsSpec = { $: {} }, mojo.interfaceControl.QueryVersionSpec = { $: {} }, mojo.interfaceControl.QueryVersionResultSpec = { $: {} }, mojo.interfaceControl.FlushForTestingSpec = { $: {} }, mojo.interfaceControl.RunOrClosePipeMessageParamsSpec = { $: {} }, mojo.interfaceControl.RequireVersionSpec = { $: {} }, mojo.interfaceControl.EnableIdleTrackingSpec = { $: {} }, mojo.interfaceControl.MessageAckSpec = { $: {} }, mojo.interfaceControl.NotifyIdleSpec = { $: {} }, mojo.interfaceControl.RunInputSpec = { $: {} }, mojo.interfaceControl.RunOutputSpec = { $: {} }, mojo.interfaceControl.RunOrClosePipeInputSpec = { $: {} }, mojo.internal.Struct(mojo.interfaceControl.RunMessageParamsSpec.$, "RunMessageParams", [mojo.internal.StructField("input", 0, 0, mojo.interfaceControl.RunInputSpec.$, null, !1, 0)], [[0, 24]]), mojo.interfaceControl.RunMessageParams = class {
	constructor() {
		this.input;
	}
}, mojo.internal.Struct(mojo.interfaceControl.RunResponseMessageParamsSpec.$, "RunResponseMessageParams", [mojo.internal.StructField("output", 0, 0, mojo.interfaceControl.RunOutputSpec.$, null, !0, 0)], [[0, 24]]), mojo.interfaceControl.RunResponseMessageParams = class {
	constructor() {
		this.output;
	}
}, mojo.internal.Struct(mojo.interfaceControl.QueryVersionSpec.$, "QueryVersion", [], [[0, 8]]), mojo.interfaceControl.QueryVersion = class {
	constructor() {}
}, mojo.internal.Struct(mojo.interfaceControl.QueryVersionResultSpec.$, "QueryVersionResult", [mojo.internal.StructField("version", 0, 0, mojo.internal.Uint32, 0, !1, 0)], [[0, 16]]), mojo.interfaceControl.QueryVersionResult = class {
	constructor() {
		this.version;
	}
}, mojo.internal.Struct(mojo.interfaceControl.FlushForTestingSpec.$, "FlushForTesting", [], [[0, 8]]), mojo.interfaceControl.FlushForTesting = class {
	constructor() {}
}, mojo.internal.Struct(mojo.interfaceControl.RunOrClosePipeMessageParamsSpec.$, "RunOrClosePipeMessageParams", [mojo.internal.StructField("input", 0, 0, mojo.interfaceControl.RunOrClosePipeInputSpec.$, null, !1, 0)], [[0, 24]]), mojo.interfaceControl.RunOrClosePipeMessageParams = class {
	constructor() {
		this.input;
	}
}, mojo.internal.Struct(mojo.interfaceControl.RequireVersionSpec.$, "RequireVersion", [mojo.internal.StructField("version", 0, 0, mojo.internal.Uint32, 0, !1, 0)], [[0, 16]]), mojo.interfaceControl.RequireVersion = class {
	constructor() {
		this.version;
	}
}, mojo.internal.Struct(mojo.interfaceControl.EnableIdleTrackingSpec.$, "EnableIdleTracking", [mojo.internal.StructField("timeoutInMicroseconds", 0, 0, mojo.internal.Int64, BigInt(0), !1, 0)], [[0, 16]]), mojo.interfaceControl.EnableIdleTracking = class {
	constructor() {
		this.timeoutInMicroseconds;
	}
}, mojo.internal.Struct(mojo.interfaceControl.MessageAckSpec.$, "MessageAck", [], [[0, 8]]), mojo.interfaceControl.MessageAck = class {
	constructor() {}
}, mojo.internal.Struct(mojo.interfaceControl.NotifyIdleSpec.$, "NotifyIdle", [], [[0, 8]]), mojo.interfaceControl.NotifyIdle = class {
	constructor() {}
}, mojo.internal.Union(mojo.interfaceControl.RunInputSpec.$, "RunInput", {
	queryVersion: {
		ordinal: 0,
		type: mojo.interfaceControl.QueryVersionSpec.$
	},
	flushForTesting: {
		ordinal: 1,
		type: mojo.interfaceControl.FlushForTestingSpec.$
	}
}), mojo.interfaceControl.RunInput, mojo.internal.Union(mojo.interfaceControl.RunOutputSpec.$, "RunOutput", { queryVersionResult: {
	ordinal: 0,
	type: mojo.interfaceControl.QueryVersionResultSpec.$
} }), mojo.interfaceControl.RunOutput, mojo.internal.Union(mojo.interfaceControl.RunOrClosePipeInputSpec.$, "RunOrClosePipeInput", {
	requireVersion: {
		ordinal: 0,
		type: mojo.interfaceControl.RequireVersionSpec.$
	},
	enableIdleTracking: {
		ordinal: 1,
		type: mojo.interfaceControl.EnableIdleTrackingSpec.$
	},
	messageAck: {
		ordinal: 2,
		type: mojo.interfaceControl.MessageAckSpec.$
	},
	notifyIdle: {
		ordinal: 3,
		type: mojo.interfaceControl.NotifyIdleSpec.$
	}
}), mojo.interfaceControl.RunOrClosePipeInput, mojo.pipeControl.RUN_OR_CLOSE_PIPE_MESSAGE_ID = 4294967294, mojo.pipeControl.RunOrClosePipeMessageParamsSpec = { $: {} }, mojo.pipeControl.DisconnectReasonSpec = { $: {} }, mojo.pipeControl.PeerAssociatedEndpointClosedEventSpec = { $: {} }, mojo.pipeControl.PauseUntilFlushCompletesSpec = { $: {} }, mojo.pipeControl.FlushAsyncSpec = { $: {} }, mojo.pipeControl.RunOrClosePipeInputSpec = { $: {} }, mojo.internal.Struct(mojo.pipeControl.RunOrClosePipeMessageParamsSpec.$, "RunOrClosePipeMessageParams", [mojo.internal.StructField("input", 0, 0, mojo.pipeControl.RunOrClosePipeInputSpec.$, null, !1, 0)], [[0, 24]]), mojo.pipeControl.RunOrClosePipeMessageParams = class {
	constructor() {
		this.input;
	}
}, mojo.internal.Struct(mojo.pipeControl.DisconnectReasonSpec.$, "DisconnectReason", [mojo.internal.StructField("customReason", 0, 0, mojo.internal.Uint32, 0, !1, 0), mojo.internal.StructField("description", 8, 0, mojo.internal.String, null, !1, 0)], [[0, 24]]), mojo.pipeControl.DisconnectReason = class {
	constructor() {
		this.customReason, this.description;
	}
}, mojo.internal.Struct(mojo.pipeControl.PeerAssociatedEndpointClosedEventSpec.$, "PeerAssociatedEndpointClosedEvent", [mojo.internal.StructField("id", 0, 0, mojo.internal.Uint32, 0, !1, 0), mojo.internal.StructField("disconnectReason", 8, 0, mojo.pipeControl.DisconnectReasonSpec.$, null, !0, 0)], [[0, 24]]), mojo.pipeControl.PeerAssociatedEndpointClosedEvent = class {
	constructor() {
		this.id, this.disconnectReason;
	}
}, mojo.internal.Struct(mojo.pipeControl.PauseUntilFlushCompletesSpec.$, "PauseUntilFlushCompletes", [mojo.internal.StructField("flushPipe", 0, 0, mojo.internal.Handle, null, !1, 0)], [[0, 16]]), mojo.pipeControl.PauseUntilFlushCompletes = class {
	constructor() {
		this.flushPipe;
	}
}, mojo.internal.Struct(mojo.pipeControl.FlushAsyncSpec.$, "FlushAsync", [mojo.internal.StructField("flusherPipe", 0, 0, mojo.internal.Handle, null, !1, 0)], [[0, 16]]), mojo.pipeControl.FlushAsync = class {
	constructor() {
		this.flusherPipe;
	}
}, mojo.internal.Union(mojo.pipeControl.RunOrClosePipeInputSpec.$, "RunOrClosePipeInput", {
	peerAssociatedEndpointClosedEvent: {
		ordinal: 0,
		type: mojo.pipeControl.PeerAssociatedEndpointClosedEventSpec.$
	},
	pauseUntilFlushCompletes: {
		ordinal: 1,
		type: mojo.pipeControl.PauseUntilFlushCompletesSpec.$
	},
	flushAsync: {
		ordinal: 2,
		type: mojo.pipeControl.FlushAsyncSpec.$
	}
}), mojo.pipeControl.RunOrClosePipeInput, mojo.internal.interfaceSupport.RouterMessage, mojo.internal.interfaceSupport.Router = class {
	constructor(e, n) {
		this.pipe_ = e, this.messages_ = [], this.dispatchInProgress_ = !1, this.reader_ = new mojo.internal.interfaceSupport.HandleReader(e), this.reader_.onRead = this.onMessageReceived_.bind(this), this.reader_.onError = this.onError_.bind(this), this.endpoints_ = /* @__PURE__ */ new Map(), this.nextInterfaceId_ = 1, this.interfaceIdNamespace_ = n ? mojo.internal.kInterfaceNamespaceBit : 0, this.pipeControlHandler_ = new mojo.internal.interfaceSupport.PipeControlMessageHandler(this, this.onPeerEndpointClosed_.bind(this));
	}
	get pipe() {
		return this.pipe_;
	}
	generateInterfaceId() {
		return (this.nextInterfaceId_++ | this.interfaceIdNamespace_) >>> 0;
	}
	addEndpoint(e, n) {
		0 === n && this.reader_.start(), console.assert(this.isReading(), "adding a secondary endpoint with no primary"), this.endpoints_.set(n, e), this.dispatchMessages_();
	}
	removeEndpoint(e) {
		this.endpoints_.delete(e), 0 === e && this.reader_.stop();
	}
	close() {
		console.assert(0 === this.endpoints_.size, "closing primary endpoint with secondary endpoints still bound"), this.reader_.stopAndCloseHandle();
	}
	closeEndpoint(e) {
		this.removeEndpoint(e), 0 === e ? this.close() : this.pipeControlHandler_.notifyEndpointClosed(e);
	}
	isReading() {
		return !this.reader_.isStopped();
	}
	send(e) {
		this.pipe_.writeMessage(e.buffer, e.handles);
	}
	onMessageReceived_(e, n) {
		if (!this.checkSize_(e)) return;
		const t = mojo.internal.deserializeMessageHeader(new DataView(e));
		this.pipeControlHandler_.maybeHandleMessage(t, e) || (this.messages_.push({
			header: t,
			buffer: e,
			handles: n
		}), this.dispatchMessages_());
	}
	checkSize_(e) {
		return !(e.byteLength < mojo.internal.kMessageV0HeaderSize) || (console.error("Rejecting undersized message"), this.onError_(), !1);
	}
	dispatchMessages_() {
		if (!this.dispatchInProgress_) {
			for (this.dispatchInProgress_ = !0; this.messages_.length > 0;) {
				const e = this.messages_[0];
				if (!this.dispatch_(e)) break;
				this.messages_.shift();
			}
			this.dispatchInProgress_ = !1;
		}
	}
	dispatch_(e) {
		const n = this.endpoints_.get(e.header.interfaceId);
		return n ? !!n.isStarted && (n.onMessageReceived(e.header, e.buffer, e.handles), !0) : (console.error(`Received message for unknown endpoint ${e.header.interfaceId}`), !1);
	}
	onError_() {
		for (const e of this.endpoints_.values()) e.onError();
		this.endpoints_.clear();
	}
	onPeerEndpointClosed_(e) {
		const n = this.endpoints_.get(e);
		n && n.onError();
	}
}, mojo.internal.interfaceSupport.EndpointClient = class {
	onMessageReceived(e, n, t, o) {}
	onError(e, n = void 0) {}
}, mojo.internal.interfaceSupport.Endpoint = class {
	constructor(e = null, n = 0) {
		this.router_ = e, this.interfaceId_ = n, this.controlMessageHandler_ = new mojo.internal.interfaceSupport.ControlMessageHandler(this), this.client_ = null, this.nextRequestId_ = 0, this.localPeer_ = null;
	}
	static createAssociatedPair() {
		const e = new mojo.internal.interfaceSupport.Endpoint(), n = new mojo.internal.interfaceSupport.Endpoint();
		return n.localPeer_ = e, e.localPeer_ = n, {
			endpoint0: e,
			endpoint1: n
		};
	}
	get router() {
		return this.router_;
	}
	isPrimary() {
		return null !== this.router_ && 0 === this.interfaceId_;
	}
	releasePipe() {
		return console.assert(this.isPrimary(), "secondary endpoint cannot release pipe"), this.router_.pipe;
	}
	get isPendingAssociation() {
		return null !== this.localPeer_;
	}
	bindInBrowser(e, n) {
		console.assert(this.isPrimary() && !this.router_.isReading(), "endpoint is either associated or already bound"), Mojo.bindInterface(e, this.router_.pipe, n);
	}
	associatePeerOfOutgoingEndpoint(e) {
		console.assert(this.router_, "cannot associate with unbound endpoint");
		const n = e.localPeer_;
		e.localPeer_ = n.localPeer_ = null;
		const t = this.router_.generateInterfaceId();
		return n.router_ = this.router_, n.interfaceId_ = t, n.client_ && this.router_.addEndpoint(n, t), t;
	}
	generateRequestId() {
		const e = this.nextRequestId_++;
		return this.nextRequestId_ > 4294967295 && (this.nextRequestId_ = 0), e;
	}
	send(e, n, t, o, i) {
		const r = new mojo.internal.Message(this, this.interfaceId_, t, e, n, o.$.structSpec, i);
		console.assert(this.router_, "cannot send message on unassociated unbound endpoint"), this.router_.send(r);
	}
	start(e) {
		console.assert(!this.client_, "endpoint already started"), this.client_ = e, this.router_ && this.router_.addEndpoint(this, this.interfaceId_);
	}
	get isStarted() {
		return null !== this.client_;
	}
	stop() {
		this.router_ && this.router_.removeEndpoint(this.interfaceId_), this.client_ = null, this.controlMessageHandler_ = null;
	}
	close() {
		this.router_ && this.router.closeEndpoint(this.interfaceId_), this.client_ = null, this.controlMessageHandler_ = null;
	}
	async flushForTesting() {
		return this.controlMessageHandler_.sendRunMessage({ flushForTesting: {} });
	}
	onMessageReceived(e, n, t) {
		console.assert(this.client_, "endpoint has no client");
		this.controlMessageHandler_.maybeHandleControlMessage(e, n) || this.client_.onMessageReceived(this, e, n, t);
	}
	onError() {
		this.client_ && this.client_.onError(this);
	}
}, mojo.internal.interfaceSupport.acceptBufferForTesting = function(e, n) {
	e.router_.onMessageReceived_(n, []);
}, mojo.internal.interfaceSupport.createEndpoint = function(e, n = !1) {
	return void 0 === e.watch ? e : new mojo.internal.interfaceSupport.Endpoint(new mojo.internal.interfaceSupport.Router(e, n), 0);
}, mojo.internal.interfaceSupport.getEndpointForReceiver = function(e) {
	return mojo.internal.interfaceSupport.createEndpoint(e);
}, mojo.internal.interfaceSupport.bind = function(e, n, t) {
	e.bindInBrowser(n, t);
}, mojo.internal.interfaceSupport.PipeControlMessageHandler = class {
	constructor(e, n) {
		this.router_ = e, this.onDisconnect_ = n;
	}
	send(e) {
		const n = new mojo.internal.Message(null, 4294967295, 0, mojo.pipeControl.RUN_OR_CLOSE_PIPE_MESSAGE_ID, 0, mojo.pipeControl.RunOrClosePipeMessageParamsSpec.$.$.structSpec, { input: e });
		this.router_.send(n);
	}
	maybeHandleMessage(e, n) {
		if (e.ordinal !== mojo.pipeControl.RUN_OR_CLOSE_PIPE_MESSAGE_ID) return !1;
		const t = new DataView(n, e.headerSize), o = new mojo.internal.Decoder(t, []), i = mojo.pipeControl.RunOrClosePipeMessageParamsSpec.$.$.structSpec, r = o.decodeStructInline(i).input;
		return !r.hasOwnProperty("peerAssociatedEndpointClosedEvent") || (this.onDisconnect_(r.peerAssociatedEndpointClosedEvent.id), !0);
	}
	notifyEndpointClosed(e) {
		this.send({ peerAssociatedEndpointClosedEvent: { id: e } });
	}
}, mojo.internal.interfaceSupport.ControlMessageHandler = class {
	constructor(e) {
		this.endpoint_ = e, this.pendingFlushResolvers_ = /* @__PURE__ */ new Map();
	}
	sendRunMessage(e) {
		const n = this.endpoint_.generateRequestId();
		return new Promise(((t) => {
			this.endpoint_.send(mojo.interfaceControl.RUN_MESSAGE_ID, n, mojo.internal.kMessageFlagExpectsResponse, mojo.interfaceControl.RunMessageParamsSpec.$, { input: e }), this.pendingFlushResolvers_.set(n, t);
		}));
	}
	maybeHandleControlMessage(e, n) {
		if (e.ordinal === mojo.interfaceControl.RUN_MESSAGE_ID) {
			const t = new DataView(n, e.headerSize), o = new mojo.internal.Decoder(t, []);
			return e.flags & mojo.internal.kMessageFlagExpectsResponse ? this.handleRunRequest_(e.requestId, o) : this.handleRunResponse_(e.requestId, o);
		}
		return !1;
	}
	handleRunRequest_(e, n) {
		return !!n.decodeStructInline(mojo.interfaceControl.RunMessageParamsSpec.$.$.structSpec).input.hasOwnProperty("flushForTesting") && (this.endpoint_.send(mojo.interfaceControl.RUN_MESSAGE_ID, e, mojo.internal.kMessageFlagIsResponse, mojo.interfaceControl.RunResponseMessageParamsSpec.$, { output: null }), !0);
	}
	handleRunResponse_(e, n) {
		const t = this.pendingFlushResolvers_.get(e);
		return !!t && (t(), !0);
	}
}, mojo.internal.interfaceSupport.PendingResponse, mojo.internal.interfaceSupport.ConnectionErrorEventRouter = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Map(), this.nextListenerId_ = 0;
	}
	addListener(e) {
		const n = ++this.nextListenerId_;
		return this.listeners.set(n, e), n;
	}
	removeListener(e) {
		return this.listeners.delete(e);
	}
	dispatchErrorEvent() {
		for (const e of this.listeners.values()) e();
	}
}, mojo.internal.interfaceSupport.PendingReceiver = class {
	get handle() {}
}, mojo.internal.interfaceSupport.InterfaceRemoteBase = class {
	constructor(e, n = void 0) {
		this.endpoint_ = null, this.requestType_ = e, this.pendingResponses_ = /* @__PURE__ */ new Map(), this.connectionErrorEventRouter_ = new mojo.internal.interfaceSupport.ConnectionErrorEventRouter(), n && this.bindHandle(n);
	}
	get endpoint() {
		return this.endpoint_;
	}
	bindNewPipeAndPassReceiver() {
		let { handle0: e, handle1: n } = Mojo.createMessagePipe();
		return this.bindHandle(e), new this.requestType_(mojo.internal.interfaceSupport.createEndpoint(n));
	}
	bindHandle(e) {
		console.assert(!this.endpoint_, "already bound"), e = mojo.internal.interfaceSupport.createEndpoint(e, !0), this.endpoint_ = e, this.endpoint_.start(this), this.pendingResponses_ = /* @__PURE__ */ new Map();
	}
	associateAndPassReceiver() {
		console.assert(!this.endpoint_, "cannot associate when already bound");
		const { endpoint0: e, endpoint1: n } = mojo.internal.interfaceSupport.Endpoint.createAssociatedPair();
		return this.bindHandle(e), new this.requestType_(n);
	}
	unbind() {
		if (!this.endpoint_) return null;
		const e = this.endpoint_;
		return this.endpoint_ = null, e.stop(), e;
	}
	close() {
		this.cleanupAndFlushPendingResponses_("Message pipe closed."), this.endpoint_ && this.endpoint_.close(), this.endpoint_ = null;
	}
	getConnectionErrorEventRouter() {
		return this.connectionErrorEventRouter_;
	}
	sendMessage(e, n, t, o, i) {
		if (t && (!this.endpoint_ || !this.endpoint_.isStarted)) return Promise.reject(/* @__PURE__ */ new Error("The pipe has already been closed."));
		const r = {};
		let s = 0;
		n.$.structSpec.fields.forEach(((e, n) => {
			const t = n - s;
			if (!mojo.internal.isNullableValueKindField(e)) return void (r[e.name] = o[t]);
			const i = e.nullableValueKindProperties;
			i.isPrimary && (s++, r[i.originalFieldName] = o[t]);
		}));
		const a = this.endpoint_.generateRequestId();
		if (this.endpoint_.send(e, a, t ? mojo.internal.kMessageFlagExpectsResponse : 0, n, r), !t) return Promise.resolve();
		const l = t;
		return new Promise(((n, t) => {
			this.pendingResponses_.set(a, {
				requestId: a,
				ordinal: e,
				responseStruct: l,
				resolve: n,
				reject: t,
				useResultResponse: i
			});
		}));
	}
	flushForTesting() {
		return this.endpoint_.flushForTesting();
	}
	onMessageReceived(e, n, t, o) {
		if (!(n.flags & mojo.internal.kMessageFlagIsResponse) || n.flags & mojo.internal.kMessageFlagExpectsResponse) return this.onError(e, "Received unexpected request message");
		const i = this.pendingResponses_.get(n.requestId);
		if (this.pendingResponses_.delete(n.requestId), !i) return this.onError(e, "Received unexpected response message");
		const r = new mojo.internal.Decoder(new DataView(t, n.headerSize), o, { endpoint: e }).decodeStructInline(i.responseStruct.$.structSpec);
		if (!r) return this.onError(e, "Received malformed response message");
		if (n.ordinal !== i.ordinal) return this.onError(e, "Received malformed response message");
		if (i.useResultResponse) {
			const e = r.result;
			void 0 !== e.success ? i.resolve(e.success) : i.reject(e.failure);
		} else i.resolve(r);
	}
	onError(e, n = void 0) {
		this.cleanupAndFlushPendingResponses_(n), this.connectionErrorEventRouter_.dispatchErrorEvent();
	}
	cleanupAndFlushPendingResponses_(e = void 0) {
		this.endpoint_ && this.endpoint_.stop();
		for (const n of this.pendingResponses_.keys()) this.pendingResponses_.get(n).reject(new Error(e));
		this.pendingResponses_ = /* @__PURE__ */ new Map();
	}
}, mojo.internal.interfaceSupport.InterfaceRemoteBaseWrapper = class {
	constructor(e) {
		this.remote_ = e;
	}
	bindNewPipeAndPassReceiver() {
		return this.remote_.bindNewPipeAndPassReceiver();
	}
	associateAndPassReceiver() {
		return this.remote_.associateAndPassReceiver();
	}
	isBound() {
		return null !== this.remote_.endpoint_;
	}
	close() {
		this.remote_.close();
	}
	flushForTesting() {
		return this.remote_.flushForTesting();
	}
}, mojo.internal.interfaceSupport.CallbackRouter = class {
	constructor() {
		this.removeCallbacks = /* @__PURE__ */ new Map(), this.nextListenerId_ = 0;
	}
	getNextId() {
		return ++this.nextListenerId_;
	}
	removeListener(e) {
		return this.removeCallbacks.get(e)(), this.removeCallbacks.delete(e);
	}
}, mojo.internal.interfaceSupport.InterfaceCallbackReceiver = class {
	constructor(e) {
		this.listeners_ = /* @__PURE__ */ new Map(), this.callbackRouter_ = e;
	}
	addListener(e) {
		const n = this.callbackRouter_.getNextId();
		return this.listeners_.set(n, e), this.callbackRouter_.removeCallbacks.set(n, (() => this.listeners_.delete(n))), n;
	}
	createReceiverHandler(e) {
		return e ? this.dispatchWithResponse_.bind(this) : this.dispatch_.bind(this);
	}
	dispatch_(e) {
		const n = Array.from(arguments);
		this.listeners_.forEach(((e) => e.apply(null, n)));
	}
	dispatchWithResponse_(e) {
		const n = Array.from(arguments), t = Array.from(this.listeners_.values()).map(((e) => e.apply(null, n)));
		let o;
		for (const e of t) if (void 0 !== e) {
			if (void 0 !== o) throw new Error("Multiple listeners attempted to reply to a message");
			o = e;
		}
		return o;
	}
}, mojo.internal.interfaceSupport.MessageHandler, mojo.internal.interfaceSupport.InterfaceReceiverHelperInternal = class {
	constructor(e) {
		this.endpoints_ = /* @__PURE__ */ new Set(), this.remoteType_ = e, this.messageHandlers_ = /* @__PURE__ */ new Map(), this.connectionErrorEventRouter_ = new mojo.internal.interfaceSupport.ConnectionErrorEventRouter();
	}
	registerHandler(e, n, t, o, i) {
		this.messageHandlers_.set(e, {
			paramStruct: n,
			responseStruct: t,
			handler: o,
			useResultResponse: i
		});
	}
	bindHandle(e) {
		e = mojo.internal.interfaceSupport.createEndpoint(e), this.endpoints_.add(e), e.start(this);
	}
	bindNewPipeAndPassRemote() {
		let e = new this.remoteType_();
		return this.bindHandle(e.$.bindNewPipeAndPassReceiver().handle), e;
	}
	associateAndPassRemote() {
		const { endpoint0: e, endpoint1: n } = mojo.internal.interfaceSupport.Endpoint.createAssociatedPair();
		return this.bindHandle(e), new this.remoteType_(n);
	}
	closeBindings() {
		for (const e of this.endpoints_) e.close();
		this.endpoints_.clear();
	}
	getConnectionErrorEventRouter() {
		return this.connectionErrorEventRouter_;
	}
	async flush() {
		for (let e of this.endpoints_) await e.flushForTesting();
	}
	onMessageReceived(e, n, t, o) {
		if (n.flags & mojo.internal.kMessageFlagIsResponse) throw new Error("Received unexpected response on interface receiver");
		const i = this.messageHandlers_.get(n.ordinal);
		if (!i) throw new Error("Received unknown message");
		const r = new mojo.internal.Decoder(new DataView(t, n.headerSize), o, { endpoint: e }).decodeStructInline(i.paramStruct.$.structSpec);
		if (!r) throw new Error("Received malformed message");
		const s = [];
		for (const e of i.paramStruct.$.structSpec.fields) {
			if (!mojo.internal.isNullableValueKindField(e)) {
				s.push(r[e.name]);
				continue;
			}
			const n = e.nullableValueKindProperties;
			n.isPrimary && s.push(r[n.originalFieldName]);
		}
		i.useResultResponse ? this.handleResultResponseMessage_(e, n, i, s) : this.handleResponseMessage_(e, n, i, s);
	}
	handleResultResponseMessage_(e, n, t, o) {
		try {
			let i = t.handler.apply(null, o);
			"object" == typeof i && "Promise" == i.constructor.name || (i = Promise.resolve(i)), i.then(((o) => {
				e.send(n.ordinal, n.requestId, mojo.internal.kMessageFlagIsResponse, t.responseStruct, { result: { success: o } });
			})).catch(((o) => {
				e.send(n.ordinal, n.requestId, mojo.internal.kMessageFlagIsResponse, t.responseStruct, { result: { failure: o } });
			}));
		} catch (o) {
			e.send(n.ordinal, n.requestId, mojo.internal.kMessageFlagIsResponse, t.responseStruct, { result: { failure: o } });
		}
	}
	handleResponseMessage_(e, n, t, o) {
		let i = t.handler.apply(null, o);
		if (t.responseStruct) {
			if (void 0 === i) throw this.onError(e), /* @__PURE__ */ new Error("Message expects a reply but its handler did not provide one.");
			"object" == typeof i && "Promise" == i.constructor.name || (i = Promise.resolve(i)), i.then(((o) => {
				e.send(n.ordinal, n.requestId, mojo.internal.kMessageFlagIsResponse, t.responseStruct, o);
			})).catch((() => {
				this.onError(e);
			}));
		}
	}
	onError(e, n = void 0) {
		this.endpoints_.delete(e), e.close(), this.connectionErrorEventRouter_.dispatchErrorEvent();
	}
}, mojo.internal.interfaceSupport.InterfaceReceiverHelper = class {
	constructor(e) {
		this.helper_internal_ = e;
	}
	bindHandle(e) {
		this.helper_internal_.bindHandle(e);
	}
	bindNewPipeAndPassRemote() {
		return this.helper_internal_.bindNewPipeAndPassRemote();
	}
	associateAndPassRemote() {
		return this.helper_internal_.associateAndPassRemote();
	}
	close() {
		this.helper_internal_.closeBindings();
	}
	flush() {
		return this.helper_internal_.flush();
	}
}, mojo.internal.interfaceSupport.HandleReader = class {
	constructor(e) {
		this.handle_ = e, this.onRead = null, this.onError = () => {}, this.watcher_ = null;
	}
	isStopped() {
		return null === this.watcher_;
	}
	start() {
		this.watcher_ = this.handle_.watch({ readable: !0 }, this.read_.bind(this));
	}
	stop() {
		this.watcher_ && (this.watcher_.cancel(), this.watcher_ = null);
	}
	stopAndCloseHandle() {
		this.watcher_ && this.stop(), this.handle_.close();
	}
	read_(e) {
		for (;;) {
			if (!this.watcher_) return;
			const e = this.handle_.readMessage();
			if (e.result == Mojo.RESULT_SHOULD_WAIT) return;
			if (e.result == Mojo.RESULT_FAILED_PRECONDITION) return void this.onError();
			if (e.result != Mojo.RESULT_OK) throw new Error("Unexpected error on HandleReader: " + e.result);
			this.onRead(e.buffer, e.handles);
		}
	}
};
mojo.internal.Enum();
var EntityTypeName;
(function(EntityTypeName) {
	EntityTypeName[EntityTypeName["MIN_VALUE"] = 0] = "MIN_VALUE";
	EntityTypeName[EntityTypeName["MAX_VALUE"] = 6] = "MAX_VALUE";
	EntityTypeName[EntityTypeName["kPassport"] = 0] = "kPassport";
	EntityTypeName[EntityTypeName["kDriversLicense"] = 1] = "kDriversLicense";
	EntityTypeName[EntityTypeName["kVehicle"] = 2] = "kVehicle";
	EntityTypeName[EntityTypeName["kNationalIdCard"] = 3] = "kNationalIdCard";
	EntityTypeName[EntityTypeName["kKnownTravelerNumber"] = 4] = "kKnownTravelerNumber";
	EntityTypeName[EntityTypeName["kRedressNumber"] = 5] = "kRedressNumber";
	EntityTypeName[EntityTypeName["kFlightReservation"] = 6] = "kFlightReservation";
})(EntityTypeName || (EntityTypeName = {}));
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_manager_proxy.js
/**
* Implementation that accesses the private API.
*/
var AutofillManagerImpl = class AutofillManagerImpl {
	getAccountInfo() {
		return chrome.autofillPrivate.getAccountInfo();
	}
	setPersonalDataManagerListener(listener) {
		chrome.autofillPrivate.onPersonalDataChanged.addListener(listener);
	}
	removePersonalDataManagerListener(listener) {
		chrome.autofillPrivate.onPersonalDataChanged.removeListener(listener);
	}
	getAddressList() {
		return chrome.autofillPrivate.getAddressList();
	}
	saveAddress(address) {
		chrome.autofillPrivate.saveAddress(address);
	}
	removeAddress(guid) {
		chrome.autofillPrivate.removeAddress(guid);
	}
	setAutofillSyncToggleEnabled(enabled) {
		chrome.autofillPrivate.setAutofillSyncToggleEnabled(enabled);
	}
	static getInstance() {
		return instance$3 || (instance$3 = new AutofillManagerImpl());
	}
	static setInstance(obj) {
		instance$3 = obj;
	}
};
var instance$3 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/payments_manager_proxy.js
/**
* Implementation that accesses the private API.
*/
var PaymentsManagerImpl = class PaymentsManagerImpl {
	setPersonalDataManagerListener(listener) {
		chrome.autofillPrivate.onPersonalDataChanged.addListener(listener);
	}
	removePersonalDataManagerListener(listener) {
		chrome.autofillPrivate.onPersonalDataChanged.removeListener(listener);
	}
	getCreditCardList() {
		return chrome.autofillPrivate.getCreditCardList();
	}
	getIbanList() {
		return chrome.autofillPrivate.getIbanList();
	}
	isValidIban(ibanValue) {
		return chrome.autofillPrivate.isValidIban(ibanValue);
	}
	removeCreditCard(guid) {
		chrome.autofillPrivate.removePaymentsEntity(guid);
	}
	saveCreditCard(creditCard) {
		chrome.autofillPrivate.saveCreditCard(creditCard);
	}
	saveIban(iban) {
		chrome.autofillPrivate.saveIban(iban);
	}
	removeIban(guid) {
		chrome.autofillPrivate.removePaymentsEntity(guid);
	}
	logServerCardLinkClicked() {
		chrome.autofillPrivate.logServerCardLinkClicked();
	}
	logServerIbanLinkClicked() {
		chrome.autofillPrivate.logServerIbanLinkClicked();
	}
	addVirtualCard(cardId) {
		chrome.autofillPrivate.addVirtualCard(cardId);
	}
	removeVirtualCard(serverId) {
		chrome.autofillPrivate.removeVirtualCard(serverId);
	}
	getPayOverTimeIssuerList() {
		return chrome.autofillPrivate.getPayOverTimeIssuerList();
	}
	isUserVerifyingPlatformAuthenticatorAvailable() {
		if (!window.PublicKeyCredential) return Promise.resolve(null);
		return window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
	}
	authenticateUserAndFlipMandatoryAuthToggle() {
		chrome.autofillPrivate.authenticateUserAndFlipMandatoryAuthToggle();
	}
	getLocalCard(guid) {
		return chrome.autofillPrivate.getLocalCard(guid);
	}
	bulkDeleteAllCvcs() {
		chrome.autofillPrivate.bulkDeleteAllCvcs();
	}
	static getInstance() {
		return instance$2 || (instance$2 = new PaymentsManagerImpl());
	}
	static setInstance(obj) {
		instance$2 = obj;
	}
};
var instance$2 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/global_scroll_target_mixin.js
/**
* @fileoverview |GlobalScrollTargetMixin| allows an element to be aware of
* the global scroll target.
*
* |scrollTarget| will be populated async by |setGlobalScrollTarget|.
*
* |subpageScrollTarget| will be equal to the |scrollTarget|, but will only be
* populated when the current route is the |subpageRoute|.
*
* |setGlobalScrollTarget| should only be called once.
*/
var scrollTargetResolver = new PromiseResolver();
var GlobalScrollTargetMixin = dedupingMixin((superClass) => {
	const superClassBase = RouteObserverMixin(superClass);
	class GlobalScrollTargetMixin extends superClassBase {
		static get properties() {
			return {
				scrollTarget: Object,
				/**
				* Read only property for the scroll target that a subpage should
				* use. It will be set/cleared based on the current route.
				*/
				subpageScrollTarget: {
					type: Object,
					computed: "getActiveTarget_(scrollTarget, active_)"
				},
				/**
				* The |subpageScrollTarget| should only be set for this route.
				*/
				subpageRoute: Object,
				/** Whether the |subpageRoute| is active or not. */
				active_: Boolean
			};
		}
		connectedCallback() {
			super.connectedCallback();
			this.active_ = Router.getInstance().getCurrentRoute() === this.subpageRoute;
			scrollTargetResolver.promise.then((scrollTarget) => {
				this.scrollTarget = scrollTarget;
			});
		}
		currentRouteChanged(route) {
			if (route === this.subpageRoute) this.active_ = true;
			else setTimeout(() => {
				this.active_ = false;
			});
		}
		/**
		* Returns the target only when the route is active.
		*/
		getActiveTarget_(target, active) {
			if (target === void 0 || active === void 0) return;
			return active ? target : null;
		}
	}
	return GlobalScrollTargetMixin;
});
/**
* This should only be called once.
*/
function setGlobalScrollTarget(scrollTarget) {
	scrollTargetResolver.resolve(scrollTarget);
}
function resetGlobalScrollTargetForTesting() {
	scrollTargetResolver = new PromiseResolver();
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings_shared/tsc/privacy_page/privacy_page_browser_proxy.js
/** @fileoverview Handles interprocess communication for the privacy page. */
/**
* Contains the possible string values for the secure DNS mode. This must be
* kept in sync with the mode names in chrome/browser/net/secure_dns_config.h.
*/
var SecureDnsMode;
(function(SecureDnsMode) {
	SecureDnsMode["OFF"] = "off";
	SecureDnsMode["AUTOMATIC"] = "automatic";
	SecureDnsMode["SECURE"] = "secure";
})(SecureDnsMode || (SecureDnsMode = {}));
/**
* Contains the possible management modes. This should be kept in sync with
* the management modes in chrome/browser/net/secure_dns_config.h.
*/
var SecureDnsUiManagementMode;
(function(SecureDnsUiManagementMode) {
	SecureDnsUiManagementMode[SecureDnsUiManagementMode["NO_OVERRIDE"] = 0] = "NO_OVERRIDE";
	SecureDnsUiManagementMode[SecureDnsUiManagementMode["DISABLED_MANAGED"] = 1] = "DISABLED_MANAGED";
	SecureDnsUiManagementMode[SecureDnsUiManagementMode["DISABLED_PARENTAL_CONTROLS"] = 2] = "DISABLED_PARENTAL_CONTROLS";
})(SecureDnsUiManagementMode || (SecureDnsUiManagementMode = {}));
var PrivacyPageBrowserProxyImpl = class PrivacyPageBrowserProxyImpl {
	getSecureDnsResolverList() {
		return sendWithPromise("getSecureDnsResolverList");
	}
	getSecureDnsSetting() {
		return sendWithPromise("getSecureDnsSetting");
	}
	isValidConfig(entry) {
		return sendWithPromise("isValidConfig", entry);
	}
	probeConfig(entry) {
		return sendWithPromise("probeConfig", entry);
	}
	static getInstance() {
		return instance$1 || (instance$1 = new PrivacyPageBrowserProxyImpl());
	}
	static setInstance(obj) {
		instance$1 = obj;
	}
};
var instance$1 = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/simple_confirmation_dialog.html.js
function getTemplate$2() {
	return Ke`<!--_html_template_start_--><cr-dialog id="dialog" close-text="$i18n{close}" show-on-attach>
  <div slot="title">[[titleText]]</div>
  <div slot="body">[[bodyText]]</div>
  <div slot="button-container">
    <cr-button  id="cancel" class="cancel-button" on-click="onCancelClick_">
      $i18n{cancel}
    </cr-button>
    <cr-button id="confirm"
        class$="[[getConfirmButtonCssClass_(noPrimaryButton)]]"
        on-click="onConfirmClick_">
      [[confirmText]]
    </cr-button>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/simple_confirmation_dialog.js
var SettingsSimpleConfirmationDialogElement = class extends PolymerElement {
	static get is() {
		return "settings-simple-confirmation-dialog";
	}
	static get template() {
		return getTemplate$2();
	}
	static get properties() {
		return {
			titleText: String,
			bodyText: String,
			confirmText: String,
			noPrimaryButton: {
				type: Boolean,
				value: false
			}
		};
	}
	/** @return Whether the user confirmed the dialog. */
	wasConfirmed() {
		return this.$.dialog.getNative().returnValue === "success";
	}
	onCancelClick_() {
		this.$.dialog.cancel();
	}
	onConfirmClick_() {
		this.$.dialog.close();
	}
	getConfirmButtonCssClass_() {
		return this.noPrimaryButton ? "" : "action-button";
	}
};
customElements.define(SettingsSimpleConfirmationDialogElement.is, SettingsSimpleConfirmationDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/passwords_shared.css.js
var styleMod = document.createElement("dom-module");
styleMod.appendChild(html`
  <template>
    <style>
:host{display:flex;flex-direction:column}.dialog-title{color:var(--cr-primary-text-color);font-size:15px;font-weight:normal;line-height:22px;margin:0;padding-block-end:16px;padding-block-start:16px}.list-with-header>div:first-of-type{border-top:var(--cr-separator-line)}.website-column{align-items:center;display:flex;flex:1}.website-column .text-elide{color:var(--cr-primary-text-color)}.username-column{display:flex;flex:1;margin:0 8px}.password-column{align-items:center;display:flex;flex:1}.password-field{background-color:transparent;border:none;flex:1;height:20px;width:0}.type-column{align-items:center;display:flex;flex:2;overflow:hidden}.ellipses{flex:1;max-width:fit-content;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.elide-left{direction:rtl}.elide-left>span{direction:ltr;unicode-bidi:bidi-override}site-favicon{margin-inline-end:16px;min-width:16px}input.password-input,cr-input.password-input::part(input),#leakedPassword{font-family:'DejaVu Sans Mono',monospace}
    </style>
  </template>
`.content);
styleMod.register("passwords-shared");
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_ai_add_or_edit_dialog.html.js
function getTemplate$1() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared md-select">:host{white-space:nowrap}.cr-form-field-label{color:var(--cr-input-label-color);font-size:11px;line-height:16px}#country-select{--md-select-width:var(--cr-input-width,100%);margin-bottom:var(--cr-form-field-bottom-spacing)}.md-select+.md-select{margin-inline-start:8px}.date-field{margin-bottom:var(--cr-form-field-bottom-spacing)}#month-select,#day-select{--md-select-width:70px}#year-select{--md-select-width:100px}#dialog::part(body-container){max-height:550px}@media all and (max-height:714px){#dialog::part(body-container){max-height:270px}}#date-validation-error{margin-top:8px}#validation-error,#date-validation-error,#invalid-date-select-label{color:var(--cr-fallback-color-error)}#footer{margin-top:8px;white-space:initial}.title-text{font-weight:bold}.title-container{display:flex;justify-content:space-between;align-items:center;width:100%}.title-icon-container{display:flex;align-items:center}.title-icon-container img{height:18px;width:auto;display:block}#validation-error-top{color:var(--cr-fallback-color-error);margin-bottom:16px}</style>
<cr-dialog id="dialog" close-text="$i18n{close}">
  <div slot="title" class="title-container">
    <div class="title-text">[[dialogTitle]]</div>

    <template is="dom-if" if="[[shouldShowWalletBranding_(saveToWalletFromSettingsEnabled_, entityInstance)]]">
      
    </template>
  </div>
  <div slot="body">
    <template is="dom-if" if="[[saveToWalletFromSettingsEnabled_]]">
      <div id="validation-error-top" class="cr-form-field-label"
          hidden="[[!validationError_]]">
        [[validationError_]]
      </div>
    </template>

    <template is="dom-repeat" items="[[completeAttributeInstanceList_]]"
        as="attributeInstanceItem">

      <template is="dom-if" if="[[isDataType_(attributeInstanceItem,
          attributeTypeDataTypeEnum_.COUNTRY)]]">
        <label id="country-select-label" class="cr-form-field-label">
          [[attributeInstanceItem.type.typeNameAsString]][[getRequiredIndicator_(attributeInstanceItem)]]
        </label>
        <select id="country-select" class="md-select"
            aria-label="[[attributeInstanceItem.type.typeNameAsString]]"
            on-change="onCountrySelectChange_">
          <option value="">$i18n{autofillDropdownNoOptionSelected}</option>
          <template is="dom-repeat" items="[[countryList_]]" as="countryItem">
            <option value="[[getCountryCode_(countryItem)]]"
                disabled="[[isCountrySeparator_(countryItem)]]"
                selected="[[isCountrySelected_(
                    attributeInstanceItem, countryItem)]]">
              [[getCountryName_(countryItem)]]
            </option>
          </template>
        </select>
      </template>

      <!-- TODO(crbug.com/406006293): Revisit the design of date pickers. -->
      <template is="dom-if" if="[[isDataType_(attributeInstanceItem,
          attributeTypeDataTypeEnum_.DATE)]]">
        <div class="date-field">

          <label id="date-select-label"
              class="cr-form-field-label"
              hidden="[[isDateInvalid_(attributeInstanceItem,
                  userClickedSaveButton_, attributeInstanceItem.*)]]">
            [[attributeInstanceItem.type.typeNameAsString]][[getRequiredIndicator_(attributeInstanceItem)]]
          </label>
          <label id="invalid-date-select-label"
              class="cr-form-field-label"
              hidden="[[!isDateInvalid_(attributeInstanceItem,
                  userClickedSaveButton_, attributeInstanceItem.*)]]">
            [[attributeInstanceItem.type.typeNameAsString]][[getRequiredIndicator_(attributeInstanceItem)]]
          </label>

          <select id="month-select" class="md-select"
              aria-label="[[i18n('autofillAiAccessibilityLabelMonthDropdown',
                  attributeInstanceItem.type.typeNameAsString)]]"
              on-change="onMonthSelectChange_">
            <option value="">
              $i18n{autofillAiMonthDropdownNoOptionSelected}
            </option>
            <template is="dom-repeat" items="[[months_]]" as="month">
              <option value="[[month]]"
                  selected="[[isMonthSelected_(attributeInstanceItem, month)]]">
                [[getMonthName_(month)]]
              </option>
            </template>
          </select>

          <select id="day-select" class="md-select"
              aria-label="[[i18n('autofillAiAccessibilityLabelDayDropdown',
                  attributeInstanceItem.type.typeNameAsString)]]"
              on-change="onDaySelectChange_">
            <option value="">
              $i18n{autofillAiDayDropdownNoOptionSelected}
            </option>
            <template is="dom-repeat" items="[[days_]]" as="day">
              <option value="[[day]]"
                  selected="[[isDaySelected_(attributeInstanceItem, day)]]">
                [[day]]
              </option>
            </template>
          </select>

          <select id="year-select" class="md-select"
              aria-label="[[i18n('autofillAiAccessibilityLabelYearDropdown',
                  attributeInstanceItem.type.typeNameAsString)]]"
              on-change="onYearSelectChange_">
            <option value="">
              $i18n{autofillAiYearDropdownNoOptionSelected}
            </option>
            <!-- isExistingYearOutOfBounds_ and getExistingYear_ purposefully
                 don't have attributeInstanceItem.* as an argument. If the user
                 selects another year, the return value of these functions
                 should not change. -->
            <template is="dom-if" if="[[isExistingYearOutOfBounds_(
                attributeInstanceItem, years_)]]">
              <option value="[[getExistingYear_(attributeInstanceItem)]]"
                  selected="true">
                [[getExistingYear_(attributeInstanceItem)]]
              </option>
            </template>
            <!-- TODO(crbug.com/403312087): Use an <hr> element instead. Resolve
                 this TODO only when an <hr> element is also used for the
                 country selector, for consistency. -->
            <!-- This separator follows the same pattern as the one for
                 the country selector. -->
            <option value="SEPARATOR" disabled>
              ------
            </option>
            <template is="dom-repeat" items="[[years_]]" as="year">
              <option value="[[year]]"
                  selected="[[isYearSelected_(attributeInstanceItem, year)]]">
                [[year]]
              </option>
            </template>
          </select>

          <div id="date-validation-error" class="cr-form-field-label"
              hidden="[[!isDateInvalid_(attributeInstanceItem,
                  userClickedSaveButton_, attributeInstanceItem.*)]]">
            $i18n{autofillAiAddOrEditDialogDateValidationError}
          </div>
        </div>
      </template>

      <template is="dom-if" if="[[isDataType_(attributeInstanceItem,
          attributeTypeDataTypeEnum_.STRING)]]">
        <cr-input id="attribute-instance-field" type="text"
            label="[[computeInputLabel_(attributeInstanceItem)]]"
            value="{{attributeInstanceItem.value}}"
            spellcheck="false" maxlength="1000"
            on-input="onAttributeInstanceFieldInput_"
            invalid="[[isFieldInvalid_(attributeInstanceItem, validationError_)]]">
        </cr-input>
      </template>

    </template>

    <template is="dom-if" if="[[!saveToWalletFromSettingsEnabled_]]">
      <div id="validation-error" class="cr-form-field-label"
       hidden="[[!validationError_]]">
        [[validationError_]]
      </div>
    </template>

    <div id="footer"
         hidden="[[!footerText_]]">
      [[footerText_]]
    </div>
  </div>
  <div slot="button-container">
    <cr-button class="cancel-button" on-click="onCancelClick_">
      $i18n{cancel}
    </cr-button>
    <cr-button class="action-button" disabled="[[!canSave_]]"
        on-click="onConfirmClick_">
      $i18n{save}
    </cr-button>
  </div>
</cr-dialog>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/country_detail_manager_proxy.js
var CountryDetailManagerProxyImpl = class CountryDetailManagerProxyImpl {
	getCountryList(forAccountStorage) {
		return chrome.autofillPrivate.getCountryList(forAccountStorage);
	}
	getAddressFormat(countryCode) {
		return chrome.autofillPrivate.getAddressComponents(countryCode);
	}
	static getInstance() {
		return instance || (instance = new CountryDetailManagerProxyImpl());
	}
	static setInstance(obj) {
		instance = obj;
	}
};
var instance = null;
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_ai_add_or_edit_dialog.js
var AttributeTypeDataType = chrome.autofillPrivate.AttributeTypeDataType;
var SettingsAutofillAiSectionElementBase = I18nMixin(PolymerElement);
var SettingsAutofillAiAddOrEditDialogElement = class extends SettingsAutofillAiSectionElementBase {
	static get is() {
		return "settings-autofill-ai-add-or-edit-dialog";
	}
	static get template() {
		return getTemplate$1();
	}
	static get properties() {
		return {
			/**
			The entity instance to be modified. If this is an "add" dialog, the
			entity instance has only a type, but no attribute instances or guid.
			*/
			entityInstance: {
				type: Object,
				value: null
			},
			dialogTitle: {
				type: String,
				value: ""
			},
			attributeTypeDataTypeEnum_: {
				type: Object,
				value: AttributeTypeDataType
			},
			/**
			Complete list of attribute instances that are associated with the
			current entity instance. If this is an "edit" dialog, some attribute
			instances are populated with their already existing values.
			*/
			completeAttributeInstanceList_: {
				type: Array,
				computed: "computeCompleteAttributeInstanceList_(countryList_, completeAttributeTypesList_)"
			},
			/**
			The list of all countries that should be displayed in a <select>
			element for a country field.
			*/
			countryList_: {
				type: Array,
				value: () => []
			},
			/**
			Complete list of attribute types that are associated with the
			current entity type.
			*/
			completeAttributeTypesList_: {
				type: Array,
				value: () => []
			},
			/**
			*  User email associated with the account.
			*/
			userEmail_: {
				type: String,
				value: ""
			},
			/**
			* Footer text shown in the view. If empty, no footer text is shown.
			*/
			footerText_: {
				type: String,
				computed: "computeFooterText_(entityInstance.*, userEmail_)"
			},
			/**
			True if all fields are empty. The first validation occurs when the user
			clicks the "Save" button for the first time. Subsequent validations
			occur any time an input field is changed. If true, the "Save" button
			is disabled and an error message is displayed.
			*/
			allFieldsAreEmpty_: {
				type: Boolean,
				value: false
			},
			/**
			False if the form is invalid. The first validation occurs when the user
			clicks the "Save" button for the first time. Subsequent validations
			occur any time an input field is changed. If false, the "Save" button
			is disabled and an error message is displayed.
			*/
			canSave_: {
				type: Boolean,
				value: true
			},
			userClickedSaveButton_: {
				type: Boolean,
				value: false
			},
			/**
			True if the feature flag to save entities to wallet from settings is
			enabled.
			*/
			saveToWalletFromSettingsEnabled_: {
				type: Boolean,
				value: () => loadTimeData$2.getBoolean("enableSaveToWalletFromSettings")
			},
			/**
			Holds the error to display (or empty string if valid).
			*/
			validationError_: {
				type: String,
				value: ""
			},
			months_: {
				type: Array,
				value: Array.from({ length: 12 }, (_, i) => i + 1).map(String)
			},
			days_: {
				type: Array,
				value: Array.from({ length: 31 }, (_, i) => i + 1).map(String)
			},
			years_: {
				type: Array,
				value: () => {
					const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
					const firstYear = currentYear - 90;
					const lastYear = currentYear + 15;
					return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index).map(String);
				}
			}
		};
	}
	requiredAttributeTypes_ = [];
	entityDataManager_ = EntityDataManagerProxyImpl.getInstance();
	countryDetailManager_ = CountryDetailManagerProxyImpl.getInstance();
	async connectedCallback() {
		super.connectedCallback();
		assert(this.entityInstance);
		this.countryList_ = await this.countryDetailManager_.getCountryList(false);
		const [attributeTypes, requiredAttributes] = await Promise.all([this.entityDataManager_.getAllAttributeTypesForEntityTypeName(this.entityInstance.type.typeName), this.entityDataManager_.getRequiredAttributeTypesForEntityTypeName(this.entityInstance.type.typeName)]);
		this.completeAttributeTypesList_ = attributeTypes;
		this.requiredAttributeTypes_ = requiredAttributes;
		const accountInfo = await chrome.autofillPrivate.getAccountInfo();
		if (accountInfo && accountInfo.email) this.userEmail_ = accountInfo.email;
		this.$.dialog.showModal();
	}
	checkRequiredFields_() {
		if (this.requiredAttributeTypes_.length === 0 || !this.saveToWalletFromSettingsEnabled_) return true;
		return this.requiredAttributeTypes_.some((req) => {
			const attribute = this.completeAttributeInstanceList_.find((attr) => attr.type.typeName === req.typeName);
			return attribute && this.isAttributeInstanceNotEmpty(attribute);
		});
	}
	computeCompleteAttributeInstanceList_() {
		if (this.countryList_.length === 0 || this.completeAttributeTypesList_.length === 0) return [];
		return this.completeAttributeTypesList_.map((attributeType) => {
			assert(this.entityInstance);
			const existingAttributeInstance = this.entityInstance.attributeInstances.find((existingAttributeInstance) => existingAttributeInstance.type.typeName === attributeType.typeName);
			this.convertCountryAttributeInstance_(existingAttributeInstance);
			return {
				type: attributeType,
				value: existingAttributeInstance?.value || (attributeType.dataType === AttributeTypeDataType.DATE ? {
					month: "",
					day: "",
					year: ""
				} : "")
			};
		});
	}
	convertCountryAttributeInstance_(attributeInstance) {
		if (!attributeInstance) return;
		if (attributeInstance.type.dataType === AttributeTypeDataType.COUNTRY) attributeInstance.value = this.countryList_.find((country) => attributeInstance.value === country.name).countryCode;
	}
	isDataType_(attributeInstance, dataType) {
		return attributeInstance.type.dataType === dataType;
	}
	getCountryCode_(country) {
		return country.countryCode || "SEPARATOR";
	}
	isCountrySeparator_(country) {
		return !country.countryCode;
	}
	getCountryName_(country) {
		return country.name || "------";
	}
	getMonthName_(month) {
		const date = /* @__PURE__ */ new Date();
		date.setDate(10);
		date.setMonth(Number(month) - 1);
		return new Intl.DateTimeFormat(document.documentElement.lang, { month: "short" }).format(date);
	}
	isCountrySelected_(attributeInstance, country) {
		return attributeInstance.value === this.getCountryCode_(country);
	}
	isMonthSelected_(attributeInstance, month) {
		return attributeInstance.value.month === month;
	}
	isDaySelected_(attributeInstance, day) {
		return attributeInstance.value.day === day;
	}
	isYearSelected_(attributeInstance, year) {
		return attributeInstance.value.year === year;
	}
	onCountrySelectChange_(e) {
		this.completeAttributeInstanceList_[e.model.index].value = e.target.value;
		this.onAttributeInstanceFieldInput_(e);
	}
	onMonthSelectChange_(e) {
		this.completeAttributeInstanceList_[e.model.index].value.month = e.target.value;
		this.notifyPath(`completeAttributeInstanceList_.${e.model.index}.value.month`);
		this.onAttributeInstanceFieldInput_(e);
	}
	onDaySelectChange_(e) {
		this.completeAttributeInstanceList_[e.model.index].value.day = e.target.value;
		this.notifyPath(`completeAttributeInstanceList_.${e.model.index}.value.day`);
		this.onAttributeInstanceFieldInput_(e);
	}
	onYearSelectChange_(e) {
		this.completeAttributeInstanceList_[e.model.index].value.year = e.target.value;
		this.notifyPath(`completeAttributeInstanceList_.${e.model.index}.value.year`);
		this.onAttributeInstanceFieldInput_(e);
	}
	/**
	* Returns '*' if the field is required.
	*/
	getRequiredIndicator_(attributeInstance) {
		if (!this.saveToWalletFromSettingsEnabled_) return "";
		return this.requiredAttributeTypes_.some((req) => req.typeName === attributeInstance.type.typeName) ? "*" : "";
	}
	/**
	* Computes the label for cr-input fields.
	* Appends '*' to the label text if required.
	*/
	computeInputLabel_(attributeInstance) {
		return attributeInstance.type.typeNameAsString + this.getRequiredIndicator_(attributeInstance);
	}
	computeFooterText_() {
		if (!this.entityInstance || this.entityInstance.guid || !this.userEmail_ || !this.entityInstance?.type.supportsWalletStorage) return "";
		return this.i18n("saveInfoToWalletAccountNotice", this.i18n("googleWalletTitle"), this.userEmail_);
	}
	isExistingYearOutOfBounds_(attributeInstance, years) {
		const year = this.getExistingYear_(attributeInstance);
		return year.length > 0 && !years.includes(year);
	}
	getExistingYear_(attributeInstance) {
		return attributeInstance.value.year;
	}
	/**
	* Returns true if the date is invalid. A date is invalid either if it is
	* incomplete (i.e. only some of the month, day, year selectors are empty), or
	* if the combination of month, day, year is invalid (i.e. 30th of February
	* 2020 is invalid).
	* Returns false if month, day, year are all empty, or if the combination of
	* month, day, year is complete and valid.
	* The first validation occurs when the user clicks the "Save" button for the
	* first time. Subsequent validations occur any time a field is changed.
	*/
	isDateInvalid_(attributeInstance) {
		if (attributeInstance.type.dataType !== AttributeTypeDataType.DATE || !this.userClickedSaveButton_) return false;
		if (this.isFieldInvalid_(attributeInstance, this.validationError_)) return true;
		const value = attributeInstance.value;
		const month = value.month;
		const day = value.day;
		const year = value.year;
		const allEmpty = month.length === 0 && day.length === 0 && year.length === 0;
		const someEmpty = month.length === 0 || day.length === 0 || year.length === 0;
		if (allEmpty) return false;
		if (someEmpty) return true;
		const date = new Date(+year, +month - 1, +day);
		return date.getFullYear() !== +year || date.getMonth() !== +month - 1 || date.getDate() !== +day;
	}
	/**
	* Returns true if the field should be highlighted as invalid due to
	* missing requirements.
	*/
	isFieldInvalid_(attributeInstance, validationError) {
		if (!this.userClickedSaveButton_ || !validationError) return false;
		if (!this.saveToWalletFromSettingsEnabled_) return false;
		return this.requiredAttributeTypes_.some((req) => req.typeName === attributeInstance.type.typeName) && !this.isAttributeInstanceNotEmpty(attributeInstance);
	}
	shouldShowWalletBranding_() {
		if (!this.saveToWalletFromSettingsEnabled_) return false;
		return !!this.entityInstance?.type.supportsWalletStorage;
	}
	/**
	* Returns true if the value is not empty and it is not made out only of
	* whitespaces.
	* For dates, at least one of month, day and year has to be not empty. An
	* incomplete date is not an empty field.
	*/
	isAttributeInstanceNotEmpty(attributeInstance) {
		if (attributeInstance.type.dataType === AttributeTypeDataType.DATE) {
			const value = attributeInstance.value;
			return value.month.trim().length > 0 || value.day.trim().length > 0 || value.year.trim().length > 0;
		}
		return attributeInstance.value.trim().length > 0;
	}
	onAttributeInstanceFieldInput_(_e) {
		if (this.userClickedSaveButton_) this.validateForm_();
	}
	validateForm_() {
		this.allFieldsAreEmpty_ = !this.completeAttributeInstanceList_.some((attributeInstance) => this.isAttributeInstanceNotEmpty(attributeInstance));
		const invalidDateExists = this.completeAttributeInstanceList_.some((attributeInstance) => this.isDateInvalid_(attributeInstance));
		const requiredFieldsMet = this.checkRequiredFields_();
		if (!requiredFieldsMet) {
			const requiredFieldNames = this.requiredAttributeTypes_.map((type) => type.typeNameAsString);
			const formattedList = new Intl.ListFormat(document.documentElement.lang, {
				style: "long",
				type: "disjunction"
			}).format(requiredFieldNames);
			this.validationError_ = this.i18n("autofillAiAddOrEditDialogRequiredFieldError", formattedList);
		} else if (this.allFieldsAreEmpty_) this.validationError_ = this.i18n("autofillAiAddOrEditDialogValidationError");
		else this.validationError_ = "";
		this.canSave_ = !this.allFieldsAreEmpty_ && !invalidDateExists && requiredFieldsMet;
	}
	onCancelClick_() {
		this.$.dialog.cancel();
	}
	onConfirmClick_() {
		this.userClickedSaveButton_ = true;
		this.validateForm_();
		if (this.canSave_) {
			const entityToSave = { ...this.entityInstance };
			if (!entityToSave.guid && entityToSave.type.supportsWalletStorage) entityToSave.storedInWallet = true;
			this.dispatchEvent(new CustomEvent("autofill-ai-add-or-edit-done", {
				bubbles: true,
				composed: true,
				detail: {
					...entityToSave,
					attributeInstances: this.completeAttributeInstanceList_.filter((attributeInstance) => this.isAttributeInstanceNotEmpty(attributeInstance))
				}
			}));
			this.$.dialog.close();
		}
	}
};
customElements.define(SettingsAutofillAiAddOrEditDialogElement.is, SettingsAutofillAiAddOrEditDialogElement);
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_ai_entries_list.html.js
function getTemplate() {
	return Ke`<!--_html_template_start_--><style include="cr-shared-style settings-shared cr-icons">.dropdown-item{display:flex;align-items:center;justify-content:space-between;width:100%}.list-item{padding-top:8px;padding-bottom:8px}.start{overflow:hidden}#entries{margin-block-end:0;margin-block-start:0}h2{align-self:auto;padding-bottom:0;padding-top:12px}.cr-row{border-top:none}</style>

<div id="entriesHeader" class="cr-row">
  <h2 class="flex">
    [[listTitle]]
  </h2>
  <!-- Disabled: If the user is not eligible for Autofill with Ai or if the
       user opted out by switching the toggle, the user should not be able to
       add entity instances. -->
  <cr-button id="addEntityInstance" class="header-aligned-button"
      disabled$="[[!allowEditing_]]" on-click="onAddEntityInstanceClick_">
    $i18n{add}
    <cr-icon icon="cr:arrow-drop-down" class="arrow-icon-down"></cr-icon>
  </cr-button>
</div>
<ul id="entries" class="list-frame vertical-list">
  <template is="dom-repeat" items="[[entityInstances_]]">
    <li class="list-item">
      <div class="start">
        <div class="ellipses">[[item.entityInstanceLabel]]</div>
        <div class="ellipses cr-secondary-text">
          [[item.entityInstanceSubLabel]]
        </div>
      </div>
      <div id="walletIndicator" hidden$="[[!item.storedInWallet]]">


        <span class="sub-label">$i18n{googleWallet}</span>

      </div>
      <template is="dom-if" if="[[item.storedInWallet]]" restamp>
        <cr-icon-button class="icon-external" id="remoteWalletPassesLink"
            title="$i18n{remoteWalletPassesLinkLabel}" role="link"
            on-click="onRemoteWalletPassesLinkClick_"
            aria-description="$i18n{opensInNewTab}">
        </cr-icon-button>
      </template>
      <template is="dom-if" if="[[!item.storedInWallet]]" restamp>
        <cr-icon-button id="moreButton" class="icon-more-vert"
            on-click="onMoreButtonClick_"
            title="[[i18n('autofillAiMoreActionsForEntityInstance',
                item.entityInstanceLabel, item.entityInstanceSubLabel)]]">
        </cr-icon-button>
      </template>
    </li>
  </template>
  <li id="entriesNone" class="list-item" hidden="[[entityInstances_.length]]">
    $i18n{autofillAiEntityInstancesNone}
  </li>
</ul>

<cr-lazy-render id="addMenu">
  <template>
    <cr-action-menu role-description="$i18n{menu}">
      <template is="dom-repeat" items="[[completeEntityTypesList_]]">
        <button id="addSpecificEntityType" class="dropdown-item"
            on-click="onAddEntityInstanceFromDropdownClick_">
          <div>[[item.typeNameAsString]]</div>
        </button>
      </template>
    </cr-action-menu>
  </template>
</cr-lazy-render>

<cr-lazy-render id="actionMenu">
  <template>
    <cr-action-menu role-description="$i18n{menu}">
      <button id="menuEditEntityInstance" class="dropdown-item"
          on-click="onMenuEditEntityInstanceClick_">$i18n{edit}</button>
      <button id="menuRemoveEntityInstance" class="dropdown-item"
          on-click="onMenuRemoveEntityInstanceClick_">$i18n{delete}</button>
    </cr-action-menu>
  </template>
</cr-lazy-render>

<template is="dom-if" if="[[showAddOrEditEntityInstanceDialog_]]" restamp>
  <settings-autofill-ai-add-or-edit-dialog id="addOrEditEntityInstanceDialog"
      entity-instance="[[activeEntityInstance_]]"
      dialog-title="[[addOrEditEntityInstanceDialogTitle_]]"
      on-autofill-ai-add-or-edit-done="onAutofillAiAddOrEditDone_"
      on-close="onAddOrEditEntityInstanceDialogClose_">
  </settings-autofill-ai-add-or-edit-dialog>
</template>
<template is="dom-if" if="[[showRemoveEntityInstanceDialog_]]" restamp>
  <settings-simple-confirmation-dialog id="removeEntityInstanceDialog"
      title-text="[[activeEntityInstanceDeleteTitle_]]"
      body-text="$i18n{autofillAiDeleteEntityInstanceDialogText}"
      confirm-text="$i18n{delete}"
      on-close="onRemoveEntityInstanceDialogClose_">
  </settings-simple-confirmation-dialog>
</template>
<!--_html_template_end_-->`;
}
//#endregion
//#region ../../../../../../../../../../home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen/chrome/browser/resources/settings/tsc/autofill_page/autofill_ai_entries_list.js
var SettingsAutofillAiEntriesListElementBase = SettingsViewMixin(WebUiListenerMixin(I18nMixin(PrefsMixin(PolymerElement))));
var SettingsAutofillAiEntriesListElement = class extends SettingsAutofillAiEntriesListElementBase {
	static get is() {
		return "settings-autofill-ai-entries-list";
	}
	static get template() {
		return getTemplate();
	}
	static get properties() {
		return {
			/**
			If a user is not eligible for Autofill with Ai, but they have data
			saved, the code allows them only to edit and delete their data. They
			are not allowed to add new data, or to opt-in or opt-out of Autofill
			with Ai using the toggle at the top of this page.
			If a user is not eligible for Autofill with Ai and they also have no
			data saved, then they cannot access this page at all.
			*/
			ineligibleUser: {
				type: Boolean,
				value() {
					return !loadTimeData$2.getBoolean("userEligibleForAutofillAi");
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
					return loadTimeData$2.getBoolean("autofillAiAvailableByDefault");
				}
			},
			/**
			Controls whether the user can use Autofill AI. For example this can be
			false if the extensions API disables the feature.
			Specifically in this file, it controls whether users can add new
			entities.
			*/
			canEnableOrDisableAutofillAi_: {
				type: Boolean,
				value() {
					return loadTimeData$2.getBoolean("canEnableOrDisableAutofillAi");
				}
			},
			allowedEntityTypes: {
				type: Set,
				value: null
			},
			listTitle: { type: String },
			/**
			Optional boolean preference used to determine the list's editability.
			If true - user will be able to add new entries to the list. Note that
			even if preference is true allows the user may still be prevented from
			adding entries due to other eligibility checks.
			*/
			allowEditingPref: {
				type: Object,
				value: null
			},
			allowEditing_: {
				type: Object,
				value: false
			},
			/**
			The corresponding `EntityInstance` model for any entity instance
			related action menus or dialogs.
			*/
			activeEntityInstance_: {
				type: Object,
				value: null
			},
			/**
			Complete list of entity types that exist. When the user wants to add a
			new entity instance, this list is displayed.
			*/
			completeEntityTypesList_: {
				type: Array,
				value: () => []
			},
			/**
			The same dialog can be used for both adding and editing entity
			instances.
			*/
			showAddOrEditEntityInstanceDialog_: {
				type: Boolean,
				value: false
			},
			addOrEditEntityInstanceDialogTitle_: {
				type: String,
				value: ""
			},
			showRemoveEntityInstanceDialog_: {
				type: Boolean,
				value: false
			},
			activeEntityInstanceDeleteTitle_: {
				type: String,
				value: ""
			},
			entityInstances_: {
				type: Array,
				value: () => []
			},
			/**
			If true, Autofill AI does not depend on whether Autofill for addresses
			is enabled.
			*/
			autofillAiIgnoresWhetherAddressFillingIsEnabled_: {
				type: Boolean,
				value() {
					return loadTimeData$2.getBoolean("AutofillAiIgnoresWhetherAddressFillingIsEnabled");
				}
			}
		};
	}
	static get observers() {
		return ["onAutofillAddressPrefChanged_(prefs.autofill.profile_enabled.value, allowEditingPref.*)", "onOptInStatusChanged_(prefs.autofill.autofill_ai.opt_in_status.value, allowEditingPref.*)"];
	}
	activeEntityInstanceGuid_ = null;
	entityInstancesChangedListener_ = null;
	entityDataManager_ = EntityDataManagerProxyImpl.getInstance();
	connectedCallback() {
		super.connectedCallback();
		this.entityDataManager_.getOptInStatus().then((optedIntoAutofillAi) => {
			if (!this.autofillAiIgnoresWhetherAddressFillingIsEnabled_ && !this.getPref("autofill.profile_enabled").value) {
				this.allowEditing_ = false;
				return;
			}
			if (!this.autofillAiAvailableByDefault_) this.allowEditing_ = !this.ineligibleUser && optedIntoAutofillAi && this.isEditingAllowedByPref_;
			else this.allowEditing_ = this.canEnableOrDisableAutofillAi_ && this.isEditingAllowedByPref_;
		});
		this.entityInstancesChangedListener_ = (entityInstances) => {
			const filteredEntityInstaces = this.allowedEntityTypes ? entityInstances.filter((instance) => this.allowedEntityTypes.has(instance.type.typeName)) : entityInstances;
			this.entityInstances_ = filteredEntityInstaces.sort(this.entityInstancesWithLabelsComparator_);
		};
		this.entityDataManager_.loadEntityInstances().then(this.entityInstancesChangedListener_);
		this.entityDataManager_.addEntityInstancesChangedListener(this.entityInstancesChangedListener_);
		this.entityDataManager_.getWritableEntityTypes().then((entityTypes) => {
			this.updateEntittyTypesList_(entityTypes);
		});
		this.addWebUiListener("sync-status-changed", this.onSyncStatusChanged_.bind(this));
	}
	disconnectedCallback() {
		super.disconnectedCallback();
		assert(this.entityInstancesChangedListener_);
		this.entityDataManager_.removeEntityInstancesChangedListener(this.entityInstancesChangedListener_);
		this.entityInstancesChangedListener_ = null;
	}
	updateEntittyTypesList_(entityTypes) {
		const filteredEntities = this.allowedEntityTypes ? entityTypes.filter((instance) => this.allowedEntityTypes.has(instance.typeName)) : entityTypes;
		this.completeEntityTypesList_ = filteredEntities.sort(this.entityTypesComparator_);
	}
	entityTypesComparator_(a, b) {
		return a.typeNameAsString.localeCompare(b.typeNameAsString, void 0, { sensitivity: "base" });
	}
	/**
	* This comparator compares the labels alphabetically, and, in case of
	* equality, the sublabels.
	* This comparator purposefully uses sensitivity 'base', not to differentiate
	* between different capitalization or diacritics.
	*/
	entityInstancesWithLabelsComparator_(a, b) {
		return (a.entityInstanceLabel + a.entityInstanceSubLabel).localeCompare(b.entityInstanceLabel + b.entityInstanceSubLabel, void 0, { sensitivity: "base" });
	}
	/**
	* Handles tapping on the "Add" entity instance button.
	*/
	onAddEntityInstanceClick_(e) {
		const addButton = e.target;
		this.$.addMenu.get().showAt(addButton, {
			anchorAlignmentX: AnchorAlignment.BEFORE_END,
			anchorAlignmentY: AnchorAlignment.AFTER_END,
			noOffset: true
		});
	}
	onAddEntityInstanceFromDropdownClick_(e) {
		e.preventDefault();
		this.activeEntityInstance_ = {
			type: e.model.item,
			attributeInstances: [],
			guid: "",
			nickname: ""
		};
		this.addOrEditEntityInstanceDialogTitle_ = this.activeEntityInstance_.type.addEntityTypeString;
		this.showAddOrEditEntityInstanceDialog_ = true;
		this.$.addMenu.get().close();
	}
	/**
	* Open the action menu.
	*/
	onMoreButtonClick_(e) {
		const moreButton = e.target;
		this.activeEntityInstanceGuid_ = e.model.item.guid;
		this.$.actionMenu.get().showAt(moreButton);
	}
	/**
	* Handles tapping on the "Edit" entity instance button in the action menu.
	*/
	async onMenuEditEntityInstanceClick_(e) {
		e.preventDefault();
		this.activeEntityInstance_ = await this.entityDataManager_.getEntityInstanceByGuid(this.activeEntityInstanceGuid_);
		if (!this.activeEntityInstance_) return;
		this.addOrEditEntityInstanceDialogTitle_ = this.activeEntityInstance_.type.editEntityTypeString;
		this.showAddOrEditEntityInstanceDialog_ = true;
		this.$.actionMenu.get().close();
	}
	/**
	* Handles tapping on the "Delete" entity instance button in the action menu.
	*/
	onMenuRemoveEntityInstanceClick_(e) {
		e.preventDefault();
		const instanceWithLabels = this.entityInstances_.find((instance) => instance.guid === this.activeEntityInstanceGuid_);
		if (!instanceWithLabels) return;
		this.activeEntityInstanceDeleteTitle_ = instanceWithLabels.type.deleteEntityTypeString;
		this.showRemoveEntityInstanceDialog_ = true;
		this.$.actionMenu.get().close();
	}
	onAutofillAiAddOrEditDone_(e) {
		e.stopPropagation();
		this.entityDataManager_.addOrUpdateEntityInstance(e.detail);
	}
	onAddOrEditEntityInstanceDialogClose_(e) {
		e.stopPropagation();
		this.showAddOrEditEntityInstanceDialog_ = false;
		this.activeEntityInstance_ = null;
	}
	onRemoveEntityInstanceDialogClose_() {
		if (this.shadowRoot.querySelector("#removeEntityInstanceDialog").wasConfirmed()) this.entityDataManager_.removeEntityInstance(this.activeEntityInstanceGuid_);
		this.showRemoveEntityInstanceDialog_ = false;
		this.activeEntityInstanceGuid_ = null;
	}
	async onAutofillAddressPrefChanged_(prefValue) {
		if (this.autofillAiIgnoresWhetherAddressFillingIsEnabled_) return;
		if (!this.autofillAiAvailableByDefault_) {
			const autofillAiOptInStatus = await this.entityDataManager_.getOptInStatus();
			this.allowEditing_ = !this.ineligibleUser && autofillAiOptInStatus && prefValue && this.isEditingAllowedByPref_;
		} else this.allowEditing_ = this.canEnableOrDisableAutofillAi_ && prefValue && this.isEditingAllowedByPref_;
	}
	onRemoteWalletPassesLinkClick_() {
		OpenWindowProxyImpl.getInstance().openUrl(loadTimeData$2.getString("walletPassesPageUrl"));
	}
	async onOptInStatusChanged_() {
		if (this.autofillAiAvailableByDefault_) return;
		const optedIn = await this.entityDataManager_.getOptInStatus();
		this.allowEditing_ = !this.ineligibleUser && optedIn && this.isEditingAllowedByPref_;
	}
	onSyncStatusChanged_(_) {
		this.entityDataManager_.getWritableEntityTypes().then((entityTypes) => {
			this.updateEntittyTypesList_(entityTypes);
		});
	}
	get isEditingAllowedByPref_() {
		return this.allowEditingPref?.value ?? true;
	}
};
customElements.define(SettingsAutofillAiEntriesListElement.is, SettingsAutofillAiEntriesListElement);
//#endregion
export { PrivacyGuideAdTopicsFragmentElement as $, CrSettingsPrefs as $n, getSearchManager as $t, CookiesExceptionType as A, SafetyCheckUnusedSitePermissionsModuleInteractions as An, PasswordManagerImpl as At, PrivacyGuideStep as B, SettingsSectionElement as Bn, ExtensionControlBrowserProxyImpl as Bt, PrivacyGuideAvailabilityMixin as C, MetricsBrowserProxyImpl as Cn, WebUiListenerMixin$1 as Ct, ContentSetting as D, PrivacyGuideStepsEligibleAndReached as Dn, ScrollableMixin as Dt, ChooserType as E, PrivacyGuideSettingsStates as En, listenOnce as Et, PrivacyGuideWelcomeFragmentElement as F, YourSavedInfoDataCategory as Fn, SettingsToggleButtonElement as Ft, PrivacyGuideCompletionFragmentElement as G, RestartType as Gn, PrefControlMixin as Gt, DefaultSettingSource as H, EventTracker as Hn, ControlledRadioButtonElement as Ht, PrivacyGuideSafeBrowsingFragmentElement as I, YourSavedInfoDataChip as In, SettingsBooleanControlMixin as It, SecuritySettingsBundleSetting as J, CrLitElement as Jn, getCss$7 as Jt, HatsBrowserProxyImpl as K, LifetimeBrowserProxyImpl as Kn, CrPolicyPrefIndicatorElement as Kt, SafeBrowsingSetting as L, YourSavedInfoRelatedService as Ln, CrPolicyPrefMixin as Lt, SettingsState as M, SafetyHubEntryPoint as Mn, I18nMixin$1 as Mt, SiteSettingSource as N, SafetyHubModuleType as Nn, sanitizeInnerHtml$1 as Nt, ContentSettingsTypes as O, SafeBrowsingInteractions as On, SiteFaviconElement as Ot, SortMethod as P, SafetyHubSurfaces as Pn, SettingsDropdownMenuElement as Pt, TimePeriod as Q, SettingsPrefsElement as Qn, combineSearchResults as Qt, PrivacyGuideMsbbFragmentElement as R, PrefsMixin as Rn, SettingsRadioGroupElement as Rt, PrivacyGuideBrowserProxyImpl as S, DeleteBrowsingDataAction as Sn, syncPrefsIndividualDataTypes as St, AllSitesDialog as T, PrivacyGuideInteractions as Tn, isMac as Tt, SiteSettingsBrowserProxyImpl as U, getCss$13 as Un, prefToString as Ut, PrivacyGuideCookiesFragmentElement as V, CrRippleMixin as Vn, loadTimeData$1 as Vt, ThirdPartyCookieBlockingSetting as W, RelaunchMixin as Wn, stringToPrefValue as Wt, BrowsingDataType as X, i$4 as Xn, SearchableViewContainerMixin as Xt, TrustSafetyInteraction as Y, E as Yn, getCss$8 as Yt, ClearBrowsingDataBrowserProxyImpl as Z, x as Zn, SearchRequest as Zt, SearchEnginesBrowserProxyImpl as _, AiPageInteractions as _n, StatusAction as _t, PrivacyPageBrowserProxyImpl as a, SettingsAiPageFeaturePrefName as an, assert$1 as ar, SafetyHubEvent as at, SettingsPrivacyGuideDialogElement as b, CardBenefitsUserAction as bn, UserSelectableType as bt, GlobalScrollTargetMixin as c, buildRouter as cn, SettingsCollapseRadioButtonElement as ct, PaymentsManagerImpl as d, Route as dn, BaseMixin as dt, showBubble as en, Fn as er, PrivacySandboxBrowserProxyImpl as et, AutofillManagerImpl as f, RouteObserverMixin as fn, SettingsSyncAccountControlElement as ft, ChoiceMadeLocation as g, AiPageHistorySearchInteractions as gn, SignedInState as gt, SettingsAiLoggingInfoBullet as h, AiPageComposeInteractions as hn, PageStatus as ht, SettingsSimpleConfirmationDialogElement as i, ModelExecutionEnterprisePolicyValue as in, tn as ir, SafetyHubBrowserProxyImpl as it, JavascriptOptimizerSetting as j, SafetyHubCardState as jn, PasswordManagerPage as jt, CookieControlsMode as k, SafetyCheckNotificationsModuleInteractions as kn, PasswordCheckReferrer as kt, resetGlobalScrollTargetForTesting as l, getTopLevelRoute as ln, TooltipMixin as lt, EntityDataManagerProxyImpl as m, pageVisibility as mn, ChromeSigninUserChoice as mt, SettingsAutofillAiAddOrEditDialogElement as n, AiPageActions as nn, d$2 as nr, CardState as nt, SecureDnsMode as o, SettingsViewMixin as on, assertNotReached$1 as or, SettingsSafetyHubModuleElement as ot, EntityTypeName as p, Router as pn, ChromeSigninAccessPoint as pt, SecurityPageV2Interaction as q, getTrustedHTML as qn, CrPolicyIndicatorType as qt, CountryDetailManagerProxyImpl as r, FeatureOptInState as rn, h as rr, PermissionsRevocationType as rt, SecureDnsUiManagementMode as s, focusWithoutInk as sn, assertNotReachedCase$1 as sr, NetworkPredictionOptions as st, SettingsAutofillAiEntriesListElement as t, AiEnterpriseFeaturePrefName as tn, Ke as tr, SettingsSafetyHubEntryPointElement as tt, setGlobalScrollTarget as u, routes as un, SettingsCheckboxListEntryElement as ut, SearchEnginesInteractions as v, AiPageTabOrganizationInteractions as vn, SyncBrowserProxyImpl as vt, AllSitesAction2 as w, PrivacyElementInteractions as wn, ProfileInfoBrowserProxyImpl as wt, SettingsPrivacyGuidePageElement as x, CvcDeletionUserAction as xn, shouldShowSyncTogglesForStatusAction as xt, ResetBrowserProxyImpl as y, AutofillSettingsReferrer as yn, TrustedVaultBannerState as yt, PrivacyGuideHistorySyncFragmentElement as z, loadTimeData$2 as zn, ExtensionControlledIndicatorElement as zt };
