# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent State Architecture

The agent system uses a stateful architecture with `VirtaAgentState` at its core:

- **State Object**: Contains messages history and log entries
- **Immutable Updates**: Each operation returns a new state object
- **Log Entries**: Tracks model invocations, tool usage, and errors
- **Performance Metrics**: Records token usage and execution times
- **Storage**: Uses structured JSON stored in blob storage at `chat/state/<hash>.json`
- **Type Safety**: Ensures consistency and reliability through TypeScript interfaces

## Build and Development Commands

- `pnpm dev` - Start service in development mode with auto-reload
- `pnpm start` - Start service in production mode
- `pnpm tsc` - Type check TypeScript files
- `pnpm node src/scripts/updateConfig.ts --file <yaml-file>` - Update service configuration from YAML file
- `pnpm node src/scripts/runAgent.ts` - Run the agent with a custom prompt

## Project Structure

- `/src/adapters` - Platform-specific adapters (e.g., LINE messaging)
- `/src/admin` - Admin interface with chat and authentication
- `/src/agent` - AI agent implementation using Google Gemini model
- `/src/elysiaPlugins` - Custom plugins for the Elysia web framework
- `/src/plugins` - Pluggable message handlers for the Brain system
- `/src/scripts` - Utility scripts for configuration and testing

## Architecture

- **Elysia Framework**: Web server built on Elysia with Node adapter
- **Brain System**: Platform-agnostic message processing system with plugin architecture
- **Plugin System**: Add new features by creating plugins in `/src/plugins` directory
- **Storage**: Azure Table Storage for configuration management
- **Blob Storage**: Azure Blob Storage for media files and chat history
  - Use `BlobSASPermissions` class from `@azure/storage-blob` for SAS URLs
  - Chat states stored as JSON at `chat/state/<hash>.json`
- **Authentication**: OpenID Connect-based authentication for admin access
- **Agent**: AI-powered agent using Google Gemini models and tools
- **VirtaAgentState**: Stateful agent architecture that preserves context and logs agent activity
- **Admin Interface**:
  - Dashboard at `/admin` with navigation to features
  - Chat interface at `/admin/chat` for interacting with the AI assistant
  - Uses layout template with Bootstrap 5 and custom BEM-styled components

## Code Style Guidelines

- **TypeScript**: Use strict typing
- **Imports**: Use explicit `.ts` extensions in import paths
- **Formatting**: 2-space indentation, semicolons at end of statements
- **Exports**: Export types and interfaces at module level
- **Error Handling**: Use try/catch with consola.error for logging
- **Platform Adapters**: Use `/src/adapters` for platform-specific code
- **Media Handling**: Upload files to Azure Blob Storage via the blob service
- **Modules**: Keep related functionality in dedicated modules (plugins, adapters, etc.)
- **Type Definitions**: Define shared types in appropriate interface files
- **State Management**: Use immutable patterns when updating state objects
- **Logging**: Include structured log entries in VirtaAgentState for tracking operations
- **CSS Guidelines**:
  - Use Bootstrap 5 classes for common components when available
  - For custom CSS, follow BEM methodology with capitalized Block names (e.g., `Message`, `Tool`)
  - Elements use double underscores: `Message__header`
  - Modifiers use double hyphens: `Message--user`
  - Extract shared styles to reusable variables to avoid duplication

## Authentication and Security

- **Encryption**: Age-based encryption for sensitive configuration values
- **Admin Interface**: Protected with OpenID Connect authentication
- **Session Management**: Remix-based session storage for maintaining user sessions
- **Config Management**: Cached config values with automatic refresh