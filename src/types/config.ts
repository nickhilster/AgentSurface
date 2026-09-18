export interface AgentSurfaceConfig {
  version: "0.1";
  site: {
    name: string;
    /** Known hostnames this repo serves. Used to build canonical URLs and scope discovery. */
    hostnames: string[];
  };
  routes: {
    /** Route path prefixes to exclude from inspection/generation entirely, beyond adapter-detected private routes. */
    exclude: string[];
  };
  output: {
    /** Where generated Markdown/manifest files are written, relative to repo root. */
    dir: string;
  };
  ownership: {
    /**
     * Conservative by default: never overwrite a file AgentSurface did not itself generate,
     * unless the file carries AgentSurface's own ownership header.
     */
    overwriteHumanOwned: boolean;
  };
}

export const DEFAULT_CONFIG: AgentSurfaceConfig = {
  version: "0.1",
  site: {
    name: "",
    hostnames: [],
  },
  routes: {
    exclude: [],
  },
  output: {
    dir: ".",
  },
  ownership: {
    overwriteHumanOwned: false,
  },
};
