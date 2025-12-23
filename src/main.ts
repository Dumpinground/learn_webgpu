import { FASTElement, html } from "@microsoft/fast-element";
// import "./style.css";
import "./components/triangle/triangle";
import "./components/gpucanvas";
import { main } from "./scripts/triangle";
import { twoWay } from "@microsoft/fast-element/binding/two-way.js";

class MainPage extends FASTElement {
  render = main;
}

MainPage.define({
  name: "main-page",
  template: html<MainPage>`<gpu-canvas
    :render=${(x) => x.render}
  ></gpu-canvas>`,
  // template: html`<triangle-canvas></triangle-canvas>`,
  // template: html`<gpu-canvas render=${main}></gpu-canvas
  // ><triangle-canvas></triangle-canvas>`,
});
