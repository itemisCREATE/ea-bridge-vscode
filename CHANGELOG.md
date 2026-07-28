# Change Log

## [1.0.6]

- Rendering support added for interaction/sequence diagrams.
- Rendering support added for activity diagrams incl. actions.
- When a 'default diagram' is configured for a project, that diagram is opened when loading a model.
- Diagram UX: mouse wheel now scrolls diagrams vertically (just like in EA), use Ctrl + mouse wheel for zoom.
- SQL console added for quick and easy database access.
- Loading large models (1000+ elements) is now possible with a (free) login.

## [1.0.5]

- New command "EA Bridge: Set up AI Assistant" equips the current workspace for AI-assisted model processing in one step: the `ea-bridge` skill and an MCP server.
- New MCP server bundled with the extension. It exposes EA Bridge tools (CLI location, JSON schema, codegen template import, diagram listing/export) to Claude Code and to GitHub Copilot agent mode.
- Diagram export to SVG via AI: assistants can now render diagrams of a model to standalone `.svg` files headlessly, without EA and without an open VS Code window.
- Diagrams are now rendered at 100% zoom level (instead of window-filled).
- Most diagram properties are respected during rendering (e.g. hidden connectors).

## [1.0.4]

- Improve diagram rendering of use case diagrams; also add rendering of artifacts and interfaces in circle notation.
- Minor improvements in model filtering and AI queries about diagrams.

## [1.0.3]

- Support added for loading models from MySQL/MariaDB and MS SQL Server remote databases (via EA shortcut files).
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
