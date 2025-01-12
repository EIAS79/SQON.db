  type SecureOptions = {
    enable: boolean;
    secret: string;
  };
  
  type RestrictionsOptions = {
    strictMode: boolean;
    dataLimit: number;
  };
  
  interface NuviraDbConfig {
    mode: "local" | "external" 
    DirPath: string;
    logs?: { enable?: boolean; logFile?: string };
    secure?: SecureOptions;
    restrictions?: RestrictionsOptions;
  }

  type AdapterResults<T> = {
    acknowledge: boolean;
    results: any;
    errorMessage?: string;
    message?: string;
  };

  interface NuviraHelper {
    query?(): void;  // Adjust the return type and parameters based on your actual methods
    crud?(): void;   // Same for these
    vector?(): void;
  }
export { NuviraDbConfig, SecureOptions, RestrictionsOptions, AdapterResults, NuviraHelper };