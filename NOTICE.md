# Third-party notices

This CLI's multi-CLI installer design — a table-driven registry of coding-agent CLIs, the
"detect installed → pick → configure" flow, and the no-install `npx` entry point — was
informed by **[vercel-labs/skills](https://github.com/vercel-labs/skills)** (MIT License).

We did not copy substantial source from that project; the registry, the per-CLI MCP-config
writers, the picker, and the command flow here are our own implementation. This notice is a
courtesy acknowledgement of the prior art that inspired the approach.

The full text of the MIT License (which would apply to any copied portions) is reproduced
below for reference:

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
