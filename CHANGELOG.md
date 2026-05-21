# Change Log

## [0.9.0] - Initial (Preview) Release

This is the first release of the itemis EA Bridge for Visual Studio Code, which enables opening and processing EA models independent of Enterprise Architect, flexible, and fast. The release includes the following key features:

- **Browsing**: Load and search your EA models inside VS Code, incl. diagrams (experimental).
- **Export**: Store the EA model as json-file for further processing.
- **Code Generation**: Discover provided codegen examples and customize them to fit your needs.
- **CLI**: Use the EA model export headless in a console, e.g. on CI.

### Known Issues / Missing Features:

- **Diagrams**: are not yet complete.
- **Properties**: or model elements may still be missing - [submit an issue](https://github.com/itemisCREATE/ea-bridge-vscode/issues/new/choose) if you need a specific element or property.
- **Remote Databases**: like MS SQL or MySQL/MariaDB are coming soon.
- **Licensing**: is not yet implemented; large models (with 2000+ elements) can currently not be loaded.
