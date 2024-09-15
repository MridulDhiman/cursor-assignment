const blogpostMarkdown = `# control

*humans should focus on bigger problems*

## Setup

\`\`\`bash
git clone git@github.com:anysphere/control
\`\`\`

\`\`\`bash
./init.sh
\`\`\`

## Folder structure

**The most important folders are:**

1. \`vscode\`: this is our fork of vscode, as a submodule.
2. \`milvus\`: this is where our Rust server code lives.
3. \`schema\`: this is our Protobuf definitions for communication between the client and the server.

Each of the above folders should contain fairly comprehensive README files; please read them. If something is missing, or not working, please add it to the README!

Some less important folders:

1. \`release\`: this is a collection of scripts and guides for releasing various things.
2. \`infra\`: infrastructure definitions for the on-prem deployment.
3. \`third_party\`: where we keep our vendored third party dependencies.

## Miscellaneous things that may or may not be useful

##### Where to find rust-proto definitions

They are in a file called \`aiserver.v1.rs\`. It might not be clear where that file is. Run \`rg --files --no-ignore bazel-out | rg aiserver.v1.rs\` to find the file.

## Releasing

Within \`vscode/\`:

- Bump the version
- Then:

\`\`\`
git checkout build-todesktop
git merge main
git push origin build-todesktop
\`\`\`

- Wait for 14 minutes for gulp and ~30 minutes for todesktop
- Go to todesktop.com, test the build locally and hit release
`;

let currentContainer: HTMLElement | null = null;
let currentElement: HTMLElement | null = null;
let inCodeBlock = false;
let codeLanguage = '';
let listLevel = 0;
let currentLine = '';
let orderedListCounter = 0;

function addToken(token: string) {
    if (!currentContainer) return;

    const lines = token.split('\n');
    lines.forEach((line, index) => {
        currentLine += line;
        if (index < lines.length - 1) {
            if (inCodeBlock) {
                handleCodeBlock(currentLine);
            } else {
                parseLine(currentLine);
            }
            currentLine = '';
        }
    });
}

function parseLine(line: string) {
    const headingMatch = line.match(/^(#{1,6})\s(.+)$/);
    if (headingMatch) {
        const level = headingMatch[1].length;
        createNewElement(`h${level}`);
        parseInline(headingMatch[2]);
        return;
    }

    if (line.startsWith('```')) {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        createNewElement('pre');
        createNewElement('code');
        if (codeLanguage) {
            currentElement!.classList.add(`language-${codeLanguage}`);
        }
        return;
    }

    const listMatch = line.match(/^(\s*)([1-9]\d*\.|\*|\-)\s(.+)$/);
    if (listMatch) {
        const [, indent, marker, content] = listMatch;
        const listType = /^\d+\./.test(marker) ? 'ol' : 'ul';
        handleListItem(indent.length, listType, content);
        return;
    }   

    if (line.startsWith('> ')) {
        createNewElement('blockquote');
        parseInline(line.slice(2));
        return;
    }

    if (line.trim() === '') {
        currentElement = null;
        orderedListCounter = 0;
        return;
    }

    if (!currentElement || currentElement.tagName !== 'P') {
        createNewElement('p');
    }

    parseInline(line);
}

function parseInline(text: string) {
    let currentText = '';
    let inEmphasis = false;
    let inStrong = false;
    let inCode = false;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '*' && text[i + 1] === '*' && !inCode) {
            if (currentText) {
                appendText(currentText);
                currentText = '';
            }
            if (inStrong) {
                currentElement = currentElement!.parentElement;
            } else {
                const strong = document.createElement('strong');
                currentElement!.appendChild(strong);
                currentElement = strong;
            }
            inStrong = !inStrong;
            i++; // Skip next asterisk
        } else if (text[i] === '*' && !inCode) {
            if (currentText) {
                appendText(currentText);
                currentText = '';
            }
            if (inEmphasis) {
                currentElement = currentElement!.parentElement;
            } else {
                const em = document.createElement('em');
                currentElement!.appendChild(em);
                currentElement = em;
            }
            inEmphasis = !inEmphasis;
        } else if (text[i] === '`') {
            if (currentText) {
                appendText(currentText);
                currentText = '';
            }
            if (inCode) {
                currentElement = currentElement!.parentElement;
            } else {
                const code = document.createElement('code');
                currentElement!.appendChild(code);
                currentElement = code;
            }
            inCode = !inCode;
        } else {
            currentText += text[i];
        }
    }

    if (currentText) {
        appendText(currentText);
    }
}

function handleCodeBlock(line: string) {
    if (line.startsWith('```')) {
        inCodeBlock = false;
        codeLanguage = '';
        currentElement = null;
    } else {
        appendText(line);
        currentElement!.appendChild(document.createElement('br'));
    }
}

function handleListItem(indent: number, listType: 'ul' | 'ol', content: string) {
    const newLevel = Math.floor(indent / 2) + 1;

    if (newLevel > listLevel) {
        for (let i = listLevel; i < newLevel; i++) {
            createNewElement(listType);
            if (listType === 'ol') {
                (currentElement as HTMLOListElement).start = orderedListCounter + 1;
            }
        }
    } else if (newLevel < listLevel) {
        for (let i = listLevel; i > newLevel; i--) {
            currentElement = currentElement!.parentElement!.parentElement;
        }
        if (listType === 'ol') {
            orderedListCounter = parseInt((currentElement as HTMLOListElement).start as any) - 1;
        }
    }

    listLevel = newLevel;
    createNewElement('li');
    if (listType === 'ol') {
        orderedListCounter++;
        (currentElement as HTMLLIElement).value = orderedListCounter;
    }
    parseInline(content);
}

function createNewElement(tag: string) {
    const element = document.createElement(tag);
    if (currentElement && currentElement.tagName === 'LI') {
        currentElement.appendChild(element);
    } else {
        currentContainer!.appendChild(element);
    }
    currentElement = element;
}

function appendText(text: string) {
    if (currentElement) {
        currentElement.appendChild(document.createTextNode(text));
    }
}

// Do not edit this method
function runStream() {
    currentContainer = document.getElementById('markdownContainer')!;

    // this randomly split the markdown into tokens between 2 and 20 characters long
    // simulates the behavior of an ml model thats giving you weirdly chunked tokens
    const tokens: string[] = [];
    let remainingMarkdown = blogpostMarkdown;
    while (remainingMarkdown.length > 0) {
        const tokenLength = Math.floor(Math.random() * 18) + 2;
        const token = remainingMarkdown.slice(0, tokenLength);
        tokens.push(token);
        remainingMarkdown = remainingMarkdown.slice(tokenLength);
    }

    const toCancel = setInterval(() => {
        const token = tokens.shift();
        if (token) {
            addToken(token);
        } else {
            clearInterval(toCancel);
        }
    }, 20);
}