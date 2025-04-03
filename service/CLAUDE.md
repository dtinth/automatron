# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- `pnpm dev` - Start service in development mode with auto-reload
- `pnpm start` - Start service in production mode
- `npx tsc` - Type check TypeScript files
- `node --experimental-transform-types --env-file=.env src/scripts/updateConfig.ts` - Update service configuration

## Code Style Guidelines

- **TypeScript**: Use strict typing
- **Imports**: Use explicit `.ts` extensions in import paths
- **Formatting**: 2-space indentation, semicolons at end of statements
- **Exports**: Export types and interfaces at module level
- **Error Handling**: Use try/catch with consola.error for logging
- **Plugin System**: Add new features by creating plugins in `/src/plugins` directory
- **Platform Adapters**: Use `/src/adapters` for platform-specific code
- **Media Handling**: Upload files to Azure Blob Storage via the blob service
- **Modules**: Keep related functionality in dedicated modules (plugins, adapters, etc.)
- **Type Definitions**: Define shared types in appropriate interface files
