(function () {
  const root = document.getElementById("hero-react-stage");
  if (!root || !window.React || !window.ReactDOM) return;
  const h = React.createElement;
  function HeroCourt() {
    return h("div", { className: "react-court-shell" },
      h("div", { className: "hero-stage-label" }, h("span", null, "CAREER MODE"), h("strong", null, "00:00:24")),
      h("svg", { className: "react-court-svg", viewBox: "0 0 520 360", role: "img", "aria-label": "Quadra de basquete com aro e bola" },
        h("defs", null, h("linearGradient", { id: "wood", x1: "0", x2: "1" }, h("stop", { offset: "0", stopColor: "#7a3918" }), h("stop", { offset: ".5", stopColor: "#d07832" }), h("stop", { offset: "1", stopColor: "#713316" })), h("radialGradient", { id: "spot" }, h("stop", { stopColor: "#ffb24a", stopOpacity: ".4" }), h("stop", { offset: "1", stopColor: "#ff7a1a", stopOpacity: "0" }))),
        h("ellipse", { cx: "260", cy: "190", rx: "220", ry: "118", fill: "url(#spot)" }),
        h("path", { className: "react-floor", d: "M70 80 L450 80 L492 292 L28 292 Z", fill: "url(#wood)" }),
        h("path", { className: "react-line", d: "M70 80 L450 80 L492 292 L28 292 Z M260 80 L260 292 M28 186 L492 186 M170 80 L170 186 L350 186 L350 80 M170 292 L170 186 L350 186 L350 292" }),
        h("ellipse", { className: "react-line", cx: "260", cy: "186", rx: "62", ry: "34" }),
        h("path", { className: "react-arc", d: "M105 292 A155 155 0 0 1 415 292" }),
        h("path", { className: "react-backboard", d: "M222 74 H298 V106 H222 Z" }), h("circle", { className: "react-hoop", cx: "260", cy: "108", r: "13" }),
        h("circle", { className: "react-ball", cx: "335", cy: "177", r: "18" }), h("path", { className: "react-ball-lines", d: "M317 177 H353 M335 159 V195 M322 164 Q335 177 348 190 M348 164 Q335 177 322 190" })
      ),
      h("div", { className: "hero-stage-stats" }, h("div", null, h("strong", null, "10"), h("span", null, "RODADAS DE DRAFT")), h("div", null, h("strong", null, "∞"), h("span", null, "CAMINHOS POSSÍVEIS")))
    );
  }
  ReactDOM.createRoot(root).render(h(HeroCourt));
})();
