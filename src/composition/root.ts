export interface ApplicationContext {
  readonly applicationName: string;
}

export function createApplicationContext(): ApplicationContext {
  return { applicationName: "Trade Journal" };
}
