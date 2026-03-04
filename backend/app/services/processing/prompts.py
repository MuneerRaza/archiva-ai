SUMMARIZE_SYSTEM = "You are a document summarization assistant. You produce clear, well-structured summaries. Format your output as markdown."

_CONTENT_FOCUS_INSTRUCTIONS = """
Important:
- Focus only on the document's actual content
- Do not describe the format, metadata, or tools used to create it
- Do not wrap your response in thinking tags or XML tags"""

SUMMARIZE_PROMPT_SHORT = """Summarize the following document in 2-3 sentences. Be concise and focus on the single most important takeaway. Do NOT use headings, bullets, or any markdown formatting — just plain sentences.
{content_focus}
{instructions}
Document:
---
{text}
---

Summary:"""

SUMMARIZE_PROMPT_MEDIUM = """Summarize the following document in 1-2 short paragraphs. Cover the key points and important details.

Formatting rules:
- Start with ONE markdown heading (##) that captures the document's topic
- Write 1-2 concise paragraphs below it
- Use **bold** for key terms or important names
- Use a short bullet list (3-5 items) if the document covers distinct points
- Use `inline code` for technical terms, file names, or commands if relevant
- Keep it scannable — no walls of text
{content_focus}
{instructions}
Document:
---
{text}
---

Summary:"""

SUMMARIZE_PROMPT_LONG = """Provide a detailed, well-structured summary of the following document. Cover all major sections, key arguments, data points, and conclusions.

Formatting rules:
- Use markdown headings (## for sections, ### for subsections) to organize the summary
- Use **bold** for emphasis on key terms, names, and important concepts
- Use bullet lists for enumerating points, features, or arguments
- Use numbered lists for sequential steps or ranked items
- Use `inline code` for technical terms, file names, commands, or code references
- Use tables if the document contains structured/comparative data worth preserving
- Use > blockquotes for notable quotes or key statements from the document
- Each section should be concise but thorough — aim for completeness without redundancy
{content_focus}
{instructions}
Document:
---
{text}
---

Summary:"""

SUMMARIZE_PROMPTS = {
    "short": SUMMARIZE_PROMPT_SHORT,
    "medium": SUMMARIZE_PROMPT_MEDIUM,
    "long": SUMMARIZE_PROMPT_LONG,
}

OVERVIEW_SYSTEM = "You generate brief, factual overviews of documents. Always respond with exactly 1-2 sentences."

OVERVIEW_PROMPT = """Write a 1-2 sentence factual overview of this document. The overview should describe what the document is and its primary subject. Do not include opinions or analysis.

Summarize only the actual document content. Ignore metadata, app names, headers/footers, watermarks, scanner software. If the document has no meaningful content, respond with an empty string.

Do not wrap your response in thinking tags or XML tags.

Document:
---
{text}
---

Overview:"""
