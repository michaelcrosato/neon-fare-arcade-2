import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { openScenePage } from "./scene-page";
import { WEBGPU_TEST_OPTIONS } from "./browser-options";
import type { CameraMode } from "../../game/model";
import type {} from "./fixtures/fallback-camera-scene";

test.use(WEBGPU_TEST_OPTIONS);
let bundle: string;
test.beforeAll(async () => {
  bundle = (await build({entryPoints:["tests/browser/fixtures/fallback-camera-scene.ts"],bundle:true,write:false,format:"iife",platform:"browser",target:"es2022",tsconfig:"tsconfig.json"})).outputFiles[0].text;
});

for (const backend of ["webgl2", "software3d"] as const) {
  test(`${backend}: real perspective in every driving camera without WebGPU`, async ({page}, info) => {
    const errors:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.addInitScript((backend) => {
      Object.defineProperty(navigator,"gpu",{value:undefined,configurable:true});
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this:HTMLCanvasElement, contextId:string, ...args:unknown[]) {
        if(contextId==="webgl2" && backend==="software3d")return null;
        const result=original.call(this,contextId,...args);
        if(contextId==="webgl2") (window as unknown as {capturedGL:unknown}).capturedGL=result;
        return result;
      } as typeof original;
    },backend);
    await openScenePage(page,bundle);
    for(const mode of ["fixed","chase-high","chase-low","cab"] as CameraMode[]) {
      const result=await page.evaluate(mode=>window.fallbackCamera.render(mode),mode);
      expect(result.backend).toBe(backend);
      if(mode!=="fixed") {
        expect(result.farWidth).toBeGreaterThan(0);
        expect(result.nearWidth).toBeGreaterThan(result.farWidth*1.4);
      }
      await page.screenshot({path:info.outputPath(`${mode}.png`)});
    }
    if(backend==="webgl2") {
      await page.evaluate(()=>window.fallbackCamera.loseContext());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const result=await page.evaluate(()=>window.fallbackCamera.render("chase-low"));
      expect(result.backend).toBe("software3d");
      expect(result.nearWidth).toBeGreaterThan(result.farWidth*1.4);
    }
    expect(errors).toEqual([]);
  });
}
