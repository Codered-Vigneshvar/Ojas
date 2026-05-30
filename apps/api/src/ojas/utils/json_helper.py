def clean_json(content: str) -> str:
    """Clean markdown and other text to extract valid JSON."""
    if not content:
        return "{}"
    
    content = content.strip()
    
    # Extract from markdown block if present
    if "```json" in content:
        parts = content.split("```json")
        if len(parts) > 1:
            content = parts[1].split("```")[0].strip()
    elif "```" in content:
        parts = content.split("```")
        if len(parts) > 1:
            content = parts[1].strip()
            
    # Remove any text before the first { or after the last }
    if "{" in content:
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            content = content[start:end+1]
            return content
            
    # If no {} is found, just return empty json string so loads doesn't crash on plain text
    return "{}"
