# ![EA Bridge Logo](media/ea-bridge_32.png) Enterprise Architect (EA) Bridge

**Browse, navigate, export, and process Enterprise Architect models on Windows, Mac OS, and Linux, also with AI.**

itemis EA Bridge reads your `.qea(x)` and `.eap(x)` project files directly. Open a model, explore its full UML hierarchy, view element properties, and render diagrams — all inside VS Code, on any OS, without EA.
Export your models in a terminal and pass them to code templates for quick and easy code generation, or use AI to analyze your model or to customize code generation templates.

> ⚠️ **Early stage:** This extension is still incomplete and may contain bugs. [Feedback and bug reports](https://github.com/itemisCREATE/ea-bridge-vscode/issues/new) are welcome.


## Why EA Bridge?

EA's native tooling requires a full installation and is limited to Windows. *EA Bridge removes both constraints*, for architects who need to browse models and for engineers who need to process them in pipelines.

|  | before | **with EA Bridge** |
|---|---|---|
| *OS support* | Windows only | Windows · **MacOS** · **Linux** |
| *EA required* | Yes | **No** |
| *Speed* | Slow (COM API) | **FAST — Rust backend, direct file access** |
| *AI tool integration* | EA ecosystem only | **Any tool that reads JSON** |
| *CI / CD pipelines* | Not suitable | **First-class CLI support** |


## For Architects — Browse your EA Model in VS Code

Open a `.qea(x)` or `.eap(x)` file in VS Code and navigate the complete UML model as a tree, even on a MacBook or a Linux workstation.

![Browse your EA model in VS Code](media/browse.gif)

- **UML hierarchy tree** — mirrors EA's own package and element structure, with type-specific icons
- **Element property panel** — name, type, stereotype, tagged values, attributes, operations, and connectors on selection
- **Diagram rendering** *(experimental)* — view EA diagrams natively in VS Code, rendered directly from the model database without EA

> **Diagram rendering is experimental.** Some element shapes, label positions, and compartment visibility settings may not yet match EA's own rendering. Fidelity is being improved continuously.


## Process your EA Models with AI

EA Bridge ships an **`ea-bridge` AI skill** for that turns your model into a queryable knowledge base.

![Ask questions about your EA model with AI](media/ai-skill.gif)

The skill loads the JSON export and lets the AI reason over your model structure, relationships, stereotypes, tagged values, etc.

**Ask questions about your model:**

> *"How many classes in my EA model have outgoing dependency connectors?"*<br>
> *"List all interfaces in package `com.example.api`."*<br>
> *"Which elements carry the stereotype `«Service»`?"*

**Trigger and customize code generation:**

> *"Generate Python code for MyModel.qea into folder out-python."*<br>
> *"Extend the Python templates to add the Author and ModifiedDate of each element to its docstring."*<br>
> *"Add a `@since` Javadoc tag to every generated Java class using the element's version field."*

The AI invokes the CLI and the bundled Jinja2 templates on your behalf (no manual command line required).<br>
It can also edit the Jinja2 templates directly in your workspace, so the change is version-controlled and reusable across your whole team.


## For Engineers — EA Models as First-Class CI Artifacts

Export any EA model to a stable, versioned JSON format with a single command.
Pipe it into Jinja2 templates, custom scripts, or AI tools — on any OS, on any CI runner, without a Windows agent or EA seat.

```bash
ea-bridge export model.qea --output model.json
```

```bash
# Or pipe directly into downstream tooling
ea-bridge export model.qea | python generate.py
```

![EA Bridge CLI export](media/cli.gif)

- **Cross-platform CLI** — pre-built binaries for Windows (x64), macOS (x64 + ARM), and Linux (x64 + ARM)
- **Versioned JSON schema** — stable contract for downstream tools
- **Sample codegen templates** — Jinja2 templates for common code generation patterns ship with the extension, ready to be customized and extended
- **AI-ready** — feed the JSON export to Claude, Copilot, or any LLM-based tool to analyze the model or to let AI customize your code generation templates
- **CI-friendly** — JSON to stdout, diagnostics to stderr, documented exit codes


## ⚠️ Extension in Development

This extension is currently a work in progress. Some features may be missing. We appreciate your patience and feedback as we continue to improve it! If you encounter any issues or have feature requests, feel free to open a ticket on our [issue tracker](https://github.com/itemisCREATE/ea-bridge-vscode/issues). For urgent cases, [contact us directly](https://www.itemis.com/en/products/ea-bridge/contact/?message=Request+for+itemis+EA-Bridge+for+VS-Code:).

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
