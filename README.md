<div align="center">

<img src="https://raw.githubusercontent.com/ComposioHQ/composio/next/public/cover.png" alt="Composio Logo" width="auto" height="auto" style="margin-bottom: 20px;"/>


# Composio SDK

Skills that evolve for your Agents

[🌐 Website](https://composio.dev) • [📚 Documentation](https://docs.composio.dev)

[![GitHub Stars](https://img.shields.io/github/stars/ComposioHQ/composio?style=social)](https://github.com/ComposioHQ/composio/stargazers)
[![PyPI Downloads](https://img.shields.io/pypi/dm/composio?label=PyPI%20Downloads)](https://pypi.org/project/composio/)
[![NPM Downloads](https://img.shields.io/npm/dt/@composio/core?label=NPM%20Downloads)](https://www.npmjs.com/package/@composio/core)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/composio)
</div>

This repository contains the official Software Development Kits (SDKs) for Composio, providing seamless integration capabilities for Python and TypeScript Agentic Frameworks and Libraries.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [TypeScript SDK](#typescript-sdk-installation)
  - [Python SDK](#python-sdk-installation)
- [Available SDKs](#available-sdks)
- [Provider Support](#provider-support)
- [Packages](#packages)
- [Rube (MCP Server)](#rube)
- [Contributing](#contributing)

## Prerequisites

- **TypeScript SDK**: Node.js 18+ and `npm`, `yarn`, or `pnpm`
- **Python SDK**: Python 3.10+ and `pip` or `poetry`
- A Composio API key — sign up at [composio.dev](https://composio.dev) to get one

## Getting Started

### TypeScript SDK Installation

```bash
# Using npm
npm install @composio/core

# Using yarn
yarn add @composio/core

# Using pnpm
pnpm add @composio/core
```

#### Initialize the client

```typescript
import { Composio } from '@composio/core';

// Initialize with your API key (or set COMPOSIO_API_KEY env variable)
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});
```

> **Tip:** You can also export your API key as an environment variable and omit `apiKey` from the constructor:
> ```bash
> export COMPOSIO_API_KEY="your-api-key"
> ```

#### Simple Agent with OpenAI Agents

```bash
npm install @composio/openai-agents @openai/agents
```

```typescript
import { Composio } from '@composio/core';
import { OpenAIAgentsProvider } from '@composio/openai-agents';
import { Agent, run } from '@openai/agents';

// Initialize Composio with the OpenAI Agents provider
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new OpenAIAgentsProvider(),
});

// Fetch tools for a specific user from HackerNews toolkit
const userId = 'user@acme.org';
const tools = await composio.tools.get(userId, {
  toolkits: ['HACKERNEWS'],
});

// Create an agent with the fetched tools
const agent = new Agent({
  name: 'Hackernews assistant',
  tools: tools,
});

// Run the agent with a natural language prompt
const result = await run(agent, 'What is the latest hackernews post about?');
console.log(JSON.stringify(result.finalOutput, null, 2));
```

#### Simple Agent with Anthropic

```bash
npm install @composio/anthropic @anthropic-ai/sdk
```

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Composio } from '@composio/core';
import { AnthropicProvider } from '@composio/anthropic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new AnthropicProvider(),
});

const userId = 'user@acme.org';
const tools = await composio.tools.get(userId, { toolkits: ['GITHUB'] });

const response = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  max_tokens: 1024,
  tools: tools,
  messages: [{ role: 'user', content: 'List my open GitHub issues' }],
});

console.log(response.content);
```

### Python SDK Installation

```bash
# Using pip
pip install composio

# Using poetry
poetry add composio
```

#### Initialize the client

```python
from composio import Composio

# Initialize with your API key (or set COMPOSIO_API_KEY env variable)
composio = Composio(
  api_key="your-api-key",  # or omit and set COMPOSIO_API_KEY
)
```

#### Simple Agent with OpenAI Agents

```bash
pip install composio_openai_agents openai-agents
```

```python
import asyncio
import os
from agents import Agent, Runner
from composio import Composio
from composio_openai_agents import OpenAIAgentsProvider

# Initialize Composio client with OpenAI Agents Provider
composio = Composio(
  api_key=os.environ["COMPOSIO_API_KEY"],
  provider=OpenAIAgentsProvider(),
)

# Fetch tools for a specific user
user_id = "user@acme.org"
tools = composio.tools.get(user_id=user_id, toolkits=["HACKERNEWS"])

# Create an agent with the tools
agent = Agent(
    name="Hackernews Agent",
    instructions="You are a helpful assistant.",
    tools=tools,
)

async def main():
    result = await Runner.run(
        starting_agent=agent,
        input="What's the latest Hackernews post about?",
    )
    print(result.final_output)

asyncio.run(main())
```

#### Simple Agent with LangChain

```bash
pip install composio_langchain langchain-openai
```

```python
import os
from composio import Composio
from composio_langchain import LangchainProvider
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

composio = Composio(
  api_key=os.environ["COMPOSIO_API_KEY"],
  provider=LangchainProvider(),
)

user_id = "user@acme.org"
tools = composio.tools.get(user_id=user_id, toolkits=["GITHUB"])

llm = ChatOpenAI(model="gpt-4o")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = executor.invoke({"input": "List my open GitHub issues"})
print(result["output"])
```

For more detailed usage instructions and examples, please refer to each SDK's specific documentation.

### Updating the OpenAPI Specification

To pull the latest API specifications from the backend:

```bash
pnpm api:pull
```

This fetches the OpenAPI spec from `https://backend.composio.dev/api/v3/openapi.json` and updates the local API documentation files. This step also runs automatically during the build.

## Available SDKs

### TypeScript SDK (`/ts`)

The TypeScript SDK provides a modern, type-safe way to interact with Composio's services. It targets both Node.js and browser environments with full TypeScript support and comprehensive type definitions.

See [TypeScript SDK Documentation](/ts/README.md) for full details.

### Python SDK (`/python`)

The Python SDK offers a Pythonic interface to Composio's services, making it easy to integrate into Python applications. It supports Python 3.10+ and follows modern development practices.

See [Python SDK Documentation](/python/README.md) for full details.

## Provider Support

The following table shows which AI frameworks and platforms are supported in each SDK:

| Provider | TypeScript | Python |
|----------|:----------:|:------:|
| OpenAI | ✅ | ✅ |
| OpenAI Agents | ✅ | ✅ |
| Anthropic | ✅ | ✅ |
| LangChain | ✅ | ✅ |
| LangGraph | ✅* | ✅ |
| LlamaIndex | ✅ | ✅ |
| Vercel AI SDK | ✅ | ❌ |
| Google Gemini | ✅ | ✅ |
| Google ADK | ❌ | ✅ |
| Mastra | ✅ | ❌ |
| Cloudflare Workers AI | ✅ | ❌ |
| CrewAI | ❌ | ✅ |
| AutoGen | ❌ | ✅ |

\* *LangGraph in TypeScript is supported via the `@composio/langchain` package.*

> **Don't see your provider?** Learn how to [build a custom provider](https://docs.composio.dev/sdk/typescript/custom-providers) to integrate with any AI framework.

## Packages

### Core Packages

| Package | Version |
|---------|-------|
| **TypeScript** | |
| [@composio/core](https://www.npmjs.com/package/@composio/core) | ![npm version](https://img.shields.io/npm/v/@composio/core) |
| **Python** | |
| [composio](https://pypi.org/project/composio/) | ![PyPI version](https://img.shields.io/pypi/v/composio) |

### Provider Packages

| Package | Version |
|---------|-------|
| **TypeScript** | |
| [@composio/openai](https://www.npmjs.com/package/@composio/openai) | ![npm version](https://img.shields.io/npm/v/@composio/openai) |
| [@composio/openai-agents](https://www.npmjs.com/package/@composio/openai-agents) | ![npm version](https://img.shields.io/npm/v/@composio/openai-agents) |
| [@composio/anthropic](https://www.npmjs.com/package/@composio/anthropic) | ![npm version](https://img.shields.io/npm/v/@composio/anthropic) |
| [@composio/langchain](https://www.npmjs.com/package/@composio/langchain) | ![npm version](https://img.shields.io/npm/v/@composio/langchain) |
| [@composio/llamaindex](https://www.npmjs.com/package/@composio/llamaindex) | ![npm version](https://img.shields.io/npm/v/@composio/llamaindex) |
| [@composio/vercel](https://www.npmjs.com/package/@composio/vercel) | ![npm version](https://img.shields.io/npm/v/@composio/vercel) |
| [@composio/google](https://www.npmjs.com/package/@composio/google) | ![npm version](https://img.shields.io/npm/v/@composio/google) |
| [@composio/mastra](https://www.npmjs.com/package/@composio/mastra) | ![npm version](https://img.shields.io/npm/v/@composio/mastra) |
| [@composio/cloudflare](https://www.npmjs.com/package/@composio/cloudflare) | ![npm version](https://img.shields.io/npm/v/@composio/cloudflare) |
| **Python** | |
| [composio-openai](https://pypi.org/project/composio-openai/) | ![PyPI version](https://img.shields.io/pypi/v/composio-openai) |
| [composio-openai-agents](https://pypi.org/project/composio-openai-agents/) | ![PyPI version](https://img.shields.io/pypi/v/composio-openai-agents) |
| [composio-anthropic](https://pypi.org/project/composio-anthropic/) | ![PyPI version](https://img.shields.io/pypi/v/composio-anthropic) |
| [composio-langchain](https://pypi.org/project/composio-langchain/) | ![PyPI version](https://img.shields.io/pypi/v/composio-langchain) |
| [composio-langgraph](https://pypi.org/project/composio-langgraph/) | ![PyPI version](https://img.shields.io/pypi/v/composio-langgraph) |
| [composio-llamaindex](https://pypi.org/project/composio-llamaindex/) | ![PyPI version](https://img.shields.io/pypi/v/composio-llamaindex) |
| [composio-crewai](https://pypi.org/project/composio-crewai/) | ![PyPI version](https://img.shields.io/pypi/v/composio-crewai) |
| [composio-autogen](https://pypi.org/project/composio-autogen/) | ![PyPI version](https://img.shields.io/pypi/v/composio-autogen) |
| [composio-gemini](https://pypi.org/project/composio-gemini/) | ![PyPI version](https://img.shields.io/pypi/v/composio-gemini) |
| [composio-google](https://pypi.org/project/composio-google/) | ![PyPI version](https://img.shields.io/pypi/v/composio-google) |
| [composio-google-adk](https://pypi.org/project/composio-google-adk/) | ![PyPI version](https://img.shields.io/pypi/v/composio-google-adk) |

### Utility Packages

| Package | Version |
|---------|-------|
| [@composio/json-schema-to-zod](https://www.npmjs.com/package/@composio/json-schema-to-zod) | ![npm version](https://img.shields.io/npm/v/@composio/json-schema-to-zod) |
| [@composio/ts-builders](https://www.npmjs.com/package/@composio/ts-builders) | ![npm version](https://img.shields.io/npm/v/@composio/ts-builders) |

_Looking for the older SDK? Find it [here](https://github.com/ComposioHQ/composio/tree/master)._

## Rube

[Rube](https://rube.app) is a Model Context Protocol (MCP) server built with Composio. It connects your AI tools to 500+ apps like Gmail, Slack, GitHub, and Notion. Install it in your AI client, authenticate once, and start asking your AI to perform real actions like "Send an email" or "Create a task."

Rube integrates with major AI clients including Cursor, Claude Desktop, VS Code, Claude Code, and any custom MCP-compatible client. Your integrations follow you across clients.

## Contributing

We welcome contributions to both SDKs! Please read our [contribution guidelines](https://github.com/ComposioHQ/composio/blob/next/CONTRIBUTING.md) before submitting pull requests.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:

- [Open an issue](https://github.com/ComposioHQ/composio/issues) in this repository
- Contact our [support team](mailto:support@composio.dev)
- Check our [documentation](https://docs.composio.dev/)
- Join us on [Discord](https://discord.gg/composio)
