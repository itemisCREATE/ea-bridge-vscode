# <img src="media/ea-bridge-logo.svg" width="32" alt="EA Bridge Logo"> Enterprise Architect (EA) Bridge

**Browse, navigate, export, and process Enterprise Architect models on Windows, Mac OS, and Linux, also with AI.**

itemis EA Bridge reads your `.qea(x)` and `.eap(x)` project files directly. Open a model, explore its full UML hierarchy, view element properties, and render diagrams — all inside VS Code, on any OS, without EA.
Export your models in a terminal and pass them to code templates for quick and easy code generation, or use AI to analyze your model or to customize code generation templates.


## Why EA Bridge?

EA's native tooling requires a full installation and is limited to Windows. EA Bridge removes both constraints — for architects who need to browse models and for engineers who need to process them in pipelines.

|  | before | **with EA Bridge** |
|---|---|---|
| *OS support* | Windows only | Windows · **MacOS** · **Linux** |
| *EA required* | Yes | **No** |
| *Speed* | Slow (COM API) | **Fast — Rust backend, direct file access** |
| *AI tool integration* | EA ecosystem only | **Any tool that reads JSON** |
| *CI / CD pipelines* | Not suitable | **First-class CLI support** |


## For Architects — Browse your EA Model in VS Code

Open a `.qea(x)` or `.eap(x)` file in VS Code and navigate the complete UML model as a tree — even on a MacBook or a Linux workstation.

<!-- Screenshot: tree view with a real EA model -->
<!-- Screenshot: diagram rendered in VS Code -->

- **UML hierarchy tree** — mirrors EA's own package and element structure, with type-specific icons
- **Element property panel** — name, type, stereotype, tagged values, attributes, operations, and connectors on selection
- **Diagram rendering** *(experimental)* — view EA diagrams natively in VS Code, rendered directly from the model database without EA

> **Diagram rendering is experimental.** Most diagrams render correctly. Some element shapes, label positions, and compartment visibility settings may not yet match EA's own rendering. Fidelity is being improved continuously.


## For Engineers — EA Models as First-Class CI Artifacts

Export any EA model to a stable, versioned JSON format with a single command. Pipe it into Jinja2 templates, custom scripts, or AI tools — on any OS, on any CI runner, without a Windows agent or EA seat.

```bash
ea-bridge export model.qea --output model.json
```

```bash
# Or pipe directly into downstream tooling
ea-bridge export model.qea | python generate.py
```

<!-- Screenshot: terminal showing CLI export with element count summary -->

- **Cross-platform CLI** — pre-built binaries for Windows (x64), macOS (x64 + ARM), and Linux (x64)
- **Versioned JSON schema** — stable contract for downstream tools
- **Sample codegen templates** — Jinja2 templates for common code generation patterns ship with the extension, ready to be customized and extended
- **AI-ready** — feed the JSON export to Claude, Copilot, or any LLM-based tool to analyze the model or to let AI customize cour code generation templates
- **CI-friendly** — JSON to stdout, diagnostics to stderr, documented exit codes, shell completions


## ⚠️ Extension in Development

This extension is currently a work in progress. Some features may be missing. We appreciate your patience and feedback as we continue to improve it! If you encounter any issues or have feature requests, feel free to open a ticket on our [issue tracker](https://github.com/itemisCREATE/ea-bridge-vscode/issues).

The following features are not yet implemented:
- **Diagrams**: are not yet complete; initial focus is on structural diagrams, behavioral ones are added soon.
- **Properties**: or model elements may still be missing.
- **Remote Databases**: like MS SQL or MySQL/MariaDB are coming soon; at the moment, only `eap(x)` and `qea(x)` files can be loaded.
- **Licensing**: is not yet implemented; itemis EA Bridge is **free for small to medium-sized models**, but large models (with 2000+ elements) can currently not be loaded.

&rarr; [Submit an issue](https://github.com/itemisCREATE/ea-bridge-vscode/issues/new/choose) if you need a specific diagram, element or property to be loaded, or if a database adapter is missing for you.

## Links

- [GitHub Repository](https://github.com/itemisCREATE/ea-bridge-vscode) — issues and changelog
- [Report a Bug](https://github.com/itemisCREATE/ea-bridge-vscode/issues/new)

---

*EA Bridge is developed by [itemis](https://www.itemis.com). Enterprise Architect is a trademark of Sparx Systems. EA Bridge is an independent tool and is not affiliated with or endorsed by Sparx Systems.*
