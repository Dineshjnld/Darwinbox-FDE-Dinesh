import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    tailwindcss(),
    tsconfigPaths(),
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});
