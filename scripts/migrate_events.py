import re
import json

def process_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find onclick, onchange, onsubmit
    # Example: onclick="Engine.setQcmMode('TRAINING')"
    pattern = re.compile(r'\b(onclick|onchange|onsubmit)\s*=\s*(["\'])(.*?)\2', re.IGNORECASE)

    events_map = []
    
    def replace_match(m):
        attr_name = m.group(1).lower()
        quote = m.group(2)
        js_code = m.group(3).strip()
        
        # Try to extract function name
        func_match = re.search(r'([A-Za-z0-9_.]+)\s*\((.*?)\)', js_code)
        if func_match:
            func_full = func_match.group(1)
            args_str = func_match.group(2)
            
            action_name = func_full.replace('Engine.', '').replace('window.FirebaseAuthEngine.', 'Auth.').replace('.', '_')
            
            # Simple escape for args
            args_clean = args_str.replace('"', '&quot;').replace("'", "&#39;")
            
            events_map.append({
                'event': attr_name.replace('on', ''),
                'action': action_name,
                'code': js_code,
                'args': args_str
            })
            
            if args_str:
                return f'data-action="{action_name}" data-args="{args_clean}"'
            else:
                return f'data-action="{action_name}"'
        else:
            # Fallback
            events_map.append({
                'event': attr_name.replace('on', ''),
                'action': 'eval_fallback',
                'code': js_code
            })
            clean_code = js_code.replace('"', '&quot;')
            return f'data-action="eval_fallback" data-code="{clean_code}"'

    new_content = pattern.sub(replace_match, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    with open('js/core/events_extracted.json', 'w', encoding='utf-8') as f:
        json.dump(events_map, f, indent=2)

    print(f"Replaced {len(events_map)} inline events.")

if __name__ == '__main__':
    process_html('index.html')
