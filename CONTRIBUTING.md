# Contributing to COMPONENT-NAME

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Code of Conduct

Please be respectful and constructive in all interactions. We want this to be a welcoming community for everyone.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

- Clear and descriptive title
- Steps to reproduce the problem
- Expected behavior vs actual behavior
- Browser and OS information
- Component version
- Screenshots if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- Clear and descriptive title
- Detailed description of the proposed functionality
- Explanation of why this enhancement would be useful
- Possible implementation approach if you have ideas

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm run test:run`
5. Run linter: `npm run lint`
6. Format code: `npm run format`
7. Commit your changes with a clear commit message
8. Push to your fork
9. Open a Pull Request

#### Pull Request Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep PRs focused on a single concern
- Write clear commit messages
- Ensure all tests pass
- Ensure code is properly formatted and linted

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`

## Testing

- Write tests for all new features
- Ensure existing tests still pass
- Aim for high test coverage
- Use `npm run test:coverage` to check coverage

## Coding Style

This project uses:
- ESLint for code quality
- Prettier for code formatting
- Vitest for testing

Run `npm run format` before committing to ensure consistent formatting.

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments to new public APIs
- Update custom-elements.json if you add/change attributes, events, or properties

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
