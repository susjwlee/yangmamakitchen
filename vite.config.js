import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: `base` must match your GitHub repo name exactly, with slashes
// on both sides, e.g. if your repo is github.com/you/yang-mamas-kitchen,
// this should be "/yang-mamas-kitchen/". If you're using a custom domain,
// or a "username.github.io" root repo, change this to "/".
export default defineConfig({
  plugins: [react()],
  base: "/yangmamakitchen/",
});
