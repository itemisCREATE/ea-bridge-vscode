# Change Log

## [1.0.3]

- Support added for loading models from MySQL/MariaDB remote databases (via EA shortcut files).
- A new command 'query' added to the CLI which allows running jq-queries against an EA model; AI skill will use that for more efficient reasoning about a model.

## [1.0.2]

- File icon theme removed again because it removed icons of all other file types except for EA models.

## [1.0.1]

- Formal adjustments for VS Code Marketplace.
- Example model added.


## [1.0.0] - Initial (Preview) Release

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
