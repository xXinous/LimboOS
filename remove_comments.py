import os
import re

def remove_comments_from_file(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Regex to match JS/TS comments.
    # Group 1 captures strings (including backticks for template literals)
    # Group 2 captures comments
    pattern = re.compile(
        r'("[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\'|`[^`\\]*(?:\\.[^`\\]*)*`)|(/\*.*?\*/|//[^\r\n]*)',
        re.MULTILINE | re.DOTALL
    )

    def replacer(match):
        if match.group(1) is not None:
            return match.group(1)
        return ''

    new_content = pattern.sub(replacer, content)

    # Clean up empty lines that were just comments
    new_content = re.sub(r'^\s*$', '', new_content, flags=re.MULTILINE)
    new_content = re.sub(r'\n+', '\n', new_content)

    with open(file_path, 'w', encoding='utf-8', errors='ignore') as f:
        f.write(new_content)

def process_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.ts', '.tsx', '.rules')):
                if 'node_modules' in root:
                    continue
                file_path = os.path.join(root, file)
                print(f"Processing {file_path}")
                remove_comments_from_file(file_path)

if __name__ == '__main__':
    process_dir('./src')
    if os.path.exists('./firestore.rules'):
        print("Processing ./firestore.rules")
        remove_comments_from_file('./firestore.rules')

