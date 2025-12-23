import { FASTElement, html } from "@microsoft/fast-element";
import "./style.css";
import "./components/triangle/triangle";
import "./components/gpucanvas";
import { main } from "./scripts/triangle";

class MainPage extends FASTElement {
  render = main;
}

MainPage.define({
  name: "main-page",
  template: html<MainPage>`<gpucanvas render=${main}></gpucanvas>`,
  // template: html`<triangle-canvas></triangle-canvas>`,
});
