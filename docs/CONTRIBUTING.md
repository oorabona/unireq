# Contributing to Unireq

Thank you for your interest in contributing to Unireq! This document provides guidelines and instructions for developing in this monorepo.

## Getting Started

This project uses [pnpm](https://pnpm.io/) for package management and workspaces.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd unireq
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Build the project:**
    To build all packages in the monorepo:
    ```bash
    pnpm build
    ```

## Development Workflow

### Running Tests
We use [Vitest](https://vitest.dev/) for testing.

-   **Run all tests:**
    ```bash
    pnpm test
    ```
-   **Run tests in watch mode:**
    ```bash
    pnpm test:watch
    ```

### Linting and Formatting
We use [Biome](https://biomejs.dev/) for fast linting and formatting.

-   **Check for linting errors:**
    ```bash
    pnpm lint
    ```
-   **Format code:**
    ```bash
    pnpm format
    ```

### Running Examples
The `examples/` directory contains various usage scenarios. You can run them using the defined scripts in `package.json`.

-   **HTTP Basic Example:**
    ```bash
    pnpm example:http
    ```
    *(Note: This runs `examples/http-basic.ts`)*

-   **See all available example scripts:**
    Check the `scripts` section in `package.json` for other examples like `example:oauth`, `example:retry`, etc.

## Architecture Overview

Unireq follows a **"pipe-first"** architecture, often visualized as an **"onion model"**.

-   **`packages/core`**: This is the foundation of the library. It provides the essential building blocks for creating clients, handling composition (`compose`), and defining the base types for requests and responses. It does not contain protocol-specific implementations (like HTTP or FTP) but rather the mechanism to chain them.
-   **The Pipeline**: Requests travel through a pipeline of handlers (middleware). Each handler can inspect, modify, or short-circuit the request before passing it to the next handler, or process the response on its way back up the chain.
-   **Plugins & Presets**: Functionality like HTTP support, OAuth, and Retries are implemented as separate packages that plug into this core pipeline.

## Pull Request Process

1.  **Clean Commits**: Please write clear, concise commit messages.
2.  **Tests Required**: Ensure that any new features or bug fixes are covered by unit tests.
3.  **Verify**: Run `pnpm test` and `pnpm lint` locally before submitting your PR to ensure CI passes.

## Coding Standards

-   **Style Enforcement**: We use **Biome** to enforce code style automatically. Please run `pnpm format` before committing.
-   **Naming**: Use clear, descriptive variable and function names.
-   **Documentation**: We encourage the use of **JSDoc** comments for public APIs and complex internal logic to ensure the codebase remains maintainable and easy to understand.