class CompatibilityRiskError extends Error {
  constructor(public path: string, message: string) {
    super(message);
    this.name = "CompatibilityRiskError";
  }
}

export { CompatibilityRiskError };
