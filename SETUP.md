# Web Component Starter - Setup Instructions

This template provides a complete setup for creating a new web component. Follow these steps to get started:

## 1. Replace Placeholders

Search and replace the following placeholders throughout the project:

- `COMPONENT-NAME` - Replace with your component's tag name (e.g., `my-awesome-component`)
- `ComponentNameElement` - Replace with your component's class name in PascalCase (e.g., `MyAwesomeComponentElement`)
- `COMPONENT_DESCRIPTION` - Replace with a description of your component

Files to update:
- `package.json`
- `README.tpl` (this will become README.md after setup)
- `COMPONENT-NAME.js` (rename this file to match your component name)
- `index.js`
- `define.js`
- `custom-elements.json`
- `test/setup.js`
- `test/COMPONENT-NAME.test.js` (rename this file)
- `demo/index.html`

## 2. Rename Files

Rename the following files to match your component name:

```bash
mv COMPONENT-NAME.js your-component-name.js
mv test/COMPONENT-NAME.test.js test/your-component-name.test.js
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Implement Your Component

Edit `your-component-name.js` to implement your web component's functionality. The template provides:

- Basic shadow DOM setup
- Attribute observation
- Event dispatching patterns
- CSS custom properties

## 5. Write Tests

Add tests to `test/your-component-name.test.js`. The template includes:

- Vitest configuration
- Happy DOM for browser-like testing
- Testing Library utilities
- Basic test structure

## 6. Update Documentation

- The README.md will be generated from README.tpl during setup
- Update the generated README.md with your component's API documentation
- Update `custom-elements.json` with accurate metadata
- Create examples in `demo/index.html`

## 7. Development Commands

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## 8. Clean Up Template Files

Delete these template-specific files:

```bash
rm SETUP.md
rm README.tpl
rm -rf scripts/
```

These files are only for template setup and shouldn't be in your component repository.

## 9. Before Publishing

1. Update the version in `package.json`
2. Ensure all tests pass: `npm run test:run`
3. Ensure code is formatted: `npm run format`
4. Ensure code passes linting: `npm run lint`
5. Test the demo locally
6. Update `custom-elements.json` if needed

## 10. Publishing to npm

```bash
npm publish
```

## Project Structure (After Cleanup)

```
.
├── COMPONENT-NAME.js          # Main component implementation
├── index.js                   # Main entry point (exports class + defines element)
├── define.js                  # Auto-define script
├── custom-elements.json       # Custom Elements Manifest
├── package.json               # Package configuration
├── README.md                  # Documentation
├── LICENSE                    # MIT License
├── .gitignore                 # Git ignore rules
├── .npmignore                 # npm ignore rules
├── .prettierrc                # Prettier configuration
├── eslint.config.js           # ESLint configuration
├── vitest.config.js           # Vitest configuration
├── test/
│   ├── setup.js              # Test setup
│   └── COMPONENT-NAME.test.js # Component tests
└── demo/
    └── index.html            # Demo page
```

## Tips

- Keep your component focused on a single responsibility
- Use semantic HTML where possible
- Provide good accessibility (ARIA attributes, keyboard navigation)
- Document all public APIs, attributes, events, and CSS custom properties
- Write comprehensive tests
- Include examples in the demo
- Follow web component best practices
