type SecureOptions = {
    enable: boolean;
    secret: string;
  };
  
  type RestrictionsOptions = {
    strictMode: boolean;
    dataLimit: number;
  };
  
  interface SqonDbConfig {
    DirPath: string;
    logs?: { enable: boolean; logFile: string };
    secure?: SecureOptions;
    restrictions?: RestrictionsOptions;
  }

  type AdapterResults<T> = {
    acknowledge: boolean;
    results: any;
    errorMessage?: string;
    message?: string;
  };

export { SqonDbConfig, SecureOptions, RestrictionsOptions, AdapterResults };