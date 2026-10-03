/** Decide the API entrypoint action before configuration or listener startup. */
export function parseApiCliAction(args: string[]): 'serve' | 'help' | 'version' {
  if (args.length === 0) return 'serve';
  if (args.length === 1) {
    if (args[0] === '--help' || args[0] === '-h') return 'help';
    if (args[0] === '--version' || args[0] === '-v') return 'version';
  }
  throw new Error('Unsupported API arguments. Use aviary-api --help for usage.');
}

export const API_CLI_HELP = `Usage: aviary-api [--help | --version]

Start the Aviary audit API with no arguments. Configure it through environment variables:
  AVIARY_API_HOST       Bind address (default: 127.0.0.1)
  AVIARY_API_PORT       Port (default: 3333)
  AVIARY_API_KEY        Bearer authentication key
  AVIARY_API_TLS_CERT   TLS certificate file (requires AVIARY_API_TLS_KEY)
  AVIARY_API_TLS_KEY    TLS private key file (requires AVIARY_API_TLS_CERT)

Non-loopback listeners require bearer authentication and TLS.
See docs/API.md for audit settings and endpoint documentation.
`;
