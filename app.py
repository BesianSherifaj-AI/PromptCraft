from flask import Flask, send_from_directory, jsonify, request, make_response
import os
import json

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Serve static files (CSS, JS, etc.)
@app.route('/<path:filename>')
def serve_static(filename):
    # Don't serve index.html through this route
    if filename == 'index.html':
        return index()
    
    # Security check to prevent directory traversal
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({"error": "Invalid filename"}), 400
    
    # Check if file exists in current directory
    if os.path.exists(filename):
        return send_from_directory('.', filename)
    
    # Check if file exists in subdirectories
    for dir_name in ['css', 'js', 'images']:
        file_path = os.path.join(dir_name, filename)
        if os.path.exists(file_path):
            return send_from_directory(dir_name, filename)
    
    return jsonify({"error": "File not found"}), 404

# Serve images with caching disabled
@app.route('/images/<path:filename>')
def serve_images(filename):
    file_path = os.path.join('images', filename)
    if not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404
    
    response = make_response(send_from_directory('images', filename))
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# List all page JSON files
@app.route('/api/pages', methods=['GET'])
def list_pages():
    files = [
        f for f in os.listdir('.') 
        if f.endswith('.json') and f not in ['prompts.json', 'package.json', 'tsconfig.json', 'bookmarks.json']
    ]
    return jsonify(files)

# Get a specific page
@app.route('/api/pages/<path:filename>', methods=['GET'])
def get_page(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 500

# Save a page
@app.route('/api/pages', methods=['POST'])
def save_page():
    data = request.json
    filename = data.get('filename')
    content = data.get('content')
    
    if not filename or content is None:
        return jsonify({"error": "Missing filename or content"}), 400
    
    if not filename.endswith('.json'):
        filename += '.json'
        
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({"error": "Invalid filename"}), 400
    
    try:
        # Handle the new format with UI state (categoryOrder and collapsedCategories)
        if content and isinstance(content, dict):
            if 'prompts' in content:
                # New format: extract the prompts data for saving
                prompts_data = content['prompts']
                
                # Convert legacy format to new variant format for backward compatibility
                for category, prompts in prompts_data.items():
                    if isinstance(prompts, list):
                        for i, prompt in enumerate(prompts):
                            if isinstance(prompt, dict) and 'variants' not in prompt:
                                # Convert old format to new variant format
                                prompts_data[category][i] = {
                                    'variants': {
                                        'Default': {
                                            'tag': prompt.get('tag', 'New'),
                                            'description': prompt.get('description', '...'),
                                            'image': prompt.get('image', None)
                                        }
                                    },
                                    'activeVariant': 'Default'
                                }
                
                # Save the full content including UI state
                content_to_save = content
            else:
                # Legacy format: just prompts data
                prompts_data = content
                
                # Convert legacy format to new variant format for backward compatibility
                for category, prompts in prompts_data.items():
                    if isinstance(prompts, list):
                        for i, prompt in enumerate(prompts):
                            if isinstance(prompt, dict) and 'variants' not in prompt:
                                # Convert old format to new variant format
                                prompts_data[category][i] = {
                                    'variants': {
                                        'Default': {
                                            'tag': prompt.get('tag', 'New'),
                                            'description': prompt.get('description', '...'),
                                            'image': prompt.get('image', None)
                                        }
                                    },
                                    'activeVariant': 'Default'
                                }
                
                content_to_save = prompts_data
        else:
            content_to_save = content
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(content_to_save, f, indent=2, ensure_ascii=False)
        return jsonify({"message": "Saved successfully", "filename": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Delete a file
@app.route('/api/delete-file', methods=['POST'])
def delete_file():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({"error": "Missing filename"}), 400
    
    # Security check
    if '..' in filename or '/' in filename or '\\' in filename:
        return jsonify({"error": "Invalid filename"}), 400
    
    try:
        if os.path.exists(filename):
            os.remove(filename)
            return jsonify({"message": "File deleted successfully", "filename": filename})
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Upload image with safety checks
@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    file = request.files.get('image')
    prompt_tag = request.form.get('prompt_tag')
    variant_name = request.form.get('variant_name', 'Default')  # Get variant name
    prompt_id = request.form.get('prompt_id', '')  # Get unique prompt ID
    
    if not file or not prompt_tag:
        return jsonify({"error": "Missing file or prompt_tag"}), 400
    
    # Safety: prevent overwriting New_Prompt.png
    if prompt_tag.strip() == "New Prompt" or (prompt_tag.strip() == "New" and variant_name == "Default"):
        return jsonify({"error": "Please edit the card name before adding an image!"}), 400
    
    os.makedirs('images', exist_ok=True)
    
    # Convert spaces to underscores for base name
    base_name = prompt_tag.replace(' ', '_')
    
    # Generate unique filename based on prompt tag, variant, and ID
    if prompt_id:
        # Use prompt ID to ensure uniqueness across different prompt instances
        safe_name = f"{base_name}_{variant_name}_{prompt_id}.png"
    else:
        # Fallback to variant-based naming for backward compatibility
        if variant_name and variant_name != 'Default':
            clean_variant = variant_name.replace(' ', '_').replace('/', '_').replace('\\', '_')
            safe_name = f"{base_name}_{clean_variant}.png"
        else:
            safe_name = f"{base_name}.png"
    
    # Clean the filename to remove any problematic characters
    safe_name = safe_name.replace(' ', '_').replace('/', '_').replace('\\', '_')
    
    file_path = os.path.join('images', safe_name)
    
    try:
        file.save(file_path)
    except Exception as e:
        return jsonify({"error": f"Failed to save image: {str(e)}"}), 500
    
    return jsonify({"message": "Image saved", "filename": safe_name})

# Extract metadata from images
@app.route('/api/extract-metadata', methods=['POST'])
def extract_metadata():
    """Extract metadata from PNG images (ComfyUI, Automatic1111, Forge)"""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    
    try:
        from PIL import Image
        from PIL.PngImagePlugin import PngInfo
        import io
        import json
        
        # Read the image file
        img = Image.open(file.stream)
        
        # Extract metadata
        metadata = {}
        
        # Get all text chunks from PNG
        if hasattr(img, 'text') and img.text:
            metadata.update(img.text)
        
        # Also check for info attribute (PIL.PngImagePlugin.PngInfo)
        if hasattr(img, 'info') and img.info:
            metadata.update(img.info)
        
        # If no metadata found, return appropriate message
        if not metadata:
            return jsonify({
                "success": False,
                "filename": file.filename,
                "error": "No metadata found in the image",
                "metadata": {
                    "filename": file.filename,
                    "source": "unknown",
                    "prompts": {},
                    "raw_metadata": {}
                }
            })
        
        # Parse metadata based on format
        result = parse_image_metadata(metadata, file.filename)
        
        return jsonify({
            "success": True,
            "filename": file.filename,
            "metadata": result
        })
        
    except Exception as e:
        return jsonify({
            "error": f"Failed to extract metadata: {str(e)}",
            "filename": file.filename,
            "metadata": {
                "filename": file.filename,
                "source": "unknown",
                "prompts": {},
                "raw_metadata": {}
            }
        }), 500

def parse_image_metadata(metadata, filename):
    """Parse metadata from different AI image generators"""
    result = {
        "filename": filename,
        "source": "unknown",
        "prompts": {},
        "raw_metadata": metadata
    }
    
    # Try ComfyUI format first (workflow JSON)
    if 'workflow' in metadata:
        result["source"] = "ComfyUI"
        try:
            workflow_data = metadata['workflow']
            if isinstance(workflow_data, str):
                workflow_data = json.loads(workflow_data)
            
            # Check if this is actually a full workflow or just a prompt string
            if isinstance(workflow_data, dict) and 'nodes' in workflow_data:
                # This is a proper ComfyUI workflow
                prompts = extract_comfyui_prompts(workflow_data)
                
                # If no prompts found in workflow nodes, look for prompt in other metadata fields
                if not prompts.get("positive", []) and not prompts.get("negative", []):
                    # First, look for the specific pattern mentioned by user: {"text": "...", "clip": 
                    for key, value in metadata.items():
                        if isinstance(value, str) and '"text":' in value and '"clip":' in value:
                            try:
                                import re
                                # Extract the text between "text": "..." - handle escaped quotes
                                match = re.search(r'"text":\s*"((?:[^"]|\\.)*)"', value)
                                if match:
                                    text_content = match.group(1)
                                    # Clean up unicode and formatting
                                    text_content = text_content.encode('utf-8', 'ignore').decode('utf-8').strip()
                                    # Replace escaped quotes
                                    text_content = text_content.replace('\\"', '"')
                                    if text_content:
                                        prompts["positive"].append(text_content)
                                        break
                            except:
                                pass
                    
                    # If still no prompt found, look for prompt-like content in other metadata fields
                    if not prompts.get("positive", []):
                        for key, value in metadata.items():
                            if isinstance(value, str) and len(value) > 10:
                                # Check if this looks like a prompt (contains common prompt words)
                                prompt_indicators = ['a ', 'the ', 'of ', 'with ', 'and ', 'in ', 'on ']
                                if any(indicator in value.lower() for indicator in prompt_indicators):
                                    # Clean up the text
                                    cleaned_value = value.encode('utf-8', 'ignore').decode('utf-8').strip()
                                    if cleaned_value.startswith('"') and cleaned_value.endswith('"'):
                                        cleaned_value = cleaned_value[1:-1]
                                    # Extract from JSON-like structures
                                    if cleaned_value.startswith('{"text": "') and cleaned_value.endswith('"}'):
                                        try:
                                            import re
                                            match = re.search(r'"text":\s*"([^"]*)"', cleaned_value)
                                            if match:
                                                cleaned_value = match.group(1)
                                        except:
                                            pass
                                    
                                    if cleaned_value:
                                        prompts["positive"].append(cleaned_value)
                                        break
                
                result["prompts"] = {
                    "positive": prompts.get("positive", []),
                    "negative": prompts.get("negative", [])
                }
            elif isinstance(workflow_data, str) and workflow_data.strip().startswith('{') and workflow_data.strip().endswith('}'):
                # This looks like JSON, try to parse it
                try:
                    parsed_workflow = json.loads(workflow_data)
                    if isinstance(parsed_workflow, dict) and 'nodes' in parsed_workflow:
                        prompts = extract_comfyui_prompts(parsed_workflow)
                        result["prompts"] = {
                            "positive": prompts.get("positive", []),
                            "negative": prompts.get("negative", [])
                        }
                    else:
                        # If it's not a proper workflow, look for prompt-like content
                        result["prompts"]["positive"] = [workflow_data]
                        result["source"] = "generic"
                except:
                    # If JSON parsing fails, treat as raw text
                    result["prompts"]["positive"] = [workflow_data]
                    result["source"] = "generic"
            else:
                # Treat as raw text/prompt
                result["prompts"]["positive"] = [workflow_data]
                result["source"] = "generic"
            
            # Final fallback: if we have workflow data but no prompts, search for prompt patterns in raw data
            if not result.get("prompts", {}).get("positive", []) and not result.get("prompts", {}).get("negative", []):
                try:
                    # Convert workflow to string and search for prompt patterns
                    workflow_str = str(workflow_data) if isinstance(workflow_data, dict) else workflow_data
                    if workflow_str:
                        # Look for the specific pattern: "text": "...", "clip": 
                        import re
                        matches = re.findall(r'"text":\s*"((?:[^"]|\\.)*)"', workflow_str)
                        if matches:
                            # Clean up the matches
                            cleaned_prompts = []
                            for match in matches:
                                if match and len(match) > 5:  # Skip very short matches
                                    cleaned = match.encode('utf-8', 'ignore').decode('utf-8').strip()
                                    if cleaned and not cleaned.startswith('{') and not cleaned.endswith('}'):
                                        cleaned_prompts.append(cleaned)
                            
                            if cleaned_prompts:
                                # Replace escaped quotes in all prompts
                                cleaned_prompts = [p.replace('\\"', '"') for p in cleaned_prompts]
                                result["prompts"]["positive"] = cleaned_prompts
                                # Try to identify negative prompts by content
                                negative_prompts = []
                                positive_prompts = []
                                for prompt in cleaned_prompts:
                                    negative_indicators = ['blurry', 'low quality', 'bad', 'deformed', 'ugly', 'extra', 'mutated', 'worst', 'lowres']
                                    if any(indicator in prompt.lower() for indicator in negative_indicators):
                                        negative_prompts.append(prompt)
                                    else:
                                        positive_prompts.append(prompt)
                                
                                result["prompts"] = {
                                    "positive": positive_prompts,
                                    "negative": negative_prompts
                                }
                except:
                    pass
            
            return result
        except Exception as e:
            # If ComfyUI parsing fails, continue to try other formats
            pass
    
    # Try Automatic1111/Forge format (parameters text)
    parameters_text = None
    if 'parameters' in metadata:
        parameters_text = metadata['parameters']
    else:
        # Look for any text chunk that contains prompt information
        for key, value in metadata.items():
            if isinstance(value, str) and ('Negative prompt:' in value or 'Steps:' in value):
                parameters_text = value
                break
    
    if parameters_text:
        result["source"] = "Automatic1111/Forge"
        parsed = parse_a1111_parameters(parameters_text)
        result["prompts"] = {
            "positive": [parsed.get("prompt", "")],
            "negative": [parsed.get("negative", "")]
        }
        result["parameters"] = parsed.get("parameters", {})
        return result
    
    # Try to find prompt in other text chunks
    for key, value in metadata.items():
        if isinstance(value, str):
            if 'prompt' in key.lower() or 'text' in key.lower():
                result["prompts"]["positive"] = [value]
                result["source"] = "generic"
                return result
            elif len(value) > 10 and any(word in value.lower() for word in ['prompt', 'negative', 'positive', 'steps', 'sampler']):
                # This might be a prompt, try to parse it as A1111 format
                try:
                    parsed = parse_a1111_parameters(value)
                    if parsed.get("prompt"):
                        result["source"] = "Automatic1111/Forge"
                        result["prompts"] = {
                            "positive": [parsed.get("prompt", "")],
                            "negative": [parsed.get("negative", "")]
                        }
                        result["parameters"] = parsed.get("parameters", {})
                        return result
                except:
                    pass
    
    return result

def extract_comfyui_prompts(workflow_data):
    """Extract prompts from ComfyUI workflow JSON"""
    prompts = {"positive": [], "negative": []}
    
    if not workflow_data or not isinstance(workflow_data, dict):
        return prompts
    
    # Handle both direct nodes and nested structure
    nodes = workflow_data.get('nodes', workflow_data)
    
    for node_id, node_data in nodes.items():
        if isinstance(node_data, dict):
            class_type = node_data.get('class_type', '')
            inputs = node_data.get('inputs', {})
            
            # Support both CLIPTextEncode and TextEncodeQwenImageEditPlus
            if (class_type == 'CLIPTextEncode' or class_type == 'TextEncodeQwenImageEditPlus') and isinstance(inputs, dict):
                # Try different input field names for prompts
                text = inputs.get('text', '') or inputs.get('prompt', '')
                if text:
                    # Clean up the text - remove JSON artifacts and fix unicode
                    if isinstance(text, str):
                        # Fix unicode escaping issues
                        text = text.encode('utf-8', 'ignore').decode('utf-8')
                        # Remove any JSON artifacts or extra formatting
                        text = text.strip()
                        if text.startswith('"') and text.endswith('"'):
                            text = text[1:-1]
                        # Remove JSON-like structures if present
                        if text.startswith('{"text": "') and text.endswith('"}'):
                            # Extract just the text part from {"text": "actual_text"}
                            try:
                                import re
                                match = re.search(r'"text":\s*"([^"]*)"', text)
                                if match:
                                    text = match.group(1)
                            except:
                                pass
                    
                    # Improved negative prompt detection
                    is_negative = False
                    
                    # Check node ID for negative indicators
                    if 'negative' in node_id.lower():
                        is_negative = True
                    
                    # Check _meta title for negative indicators
                    meta = node_data.get('_meta', {})
                    if meta.get('title', '').lower() and 'negative' in meta.get('title', '').lower():
                        is_negative = True
                    
                    # Heuristic: if prompt contains typical negative prompt terms
                    negative_indicators = ['blurry', 'low quality', 'bad', 'deformed', 'ugly', 'extra', 'mutated', 'worst', 'lowres']
                    if any(indicator in text.lower() for indicator in negative_indicators):
                        is_negative = True
                    
                    if is_negative:
                        prompts["negative"].append(text)
                    else:
                        prompts["positive"].append(text)
    
    return prompts

def parse_a1111_parameters(parameters_text):
    """Parse Automatic1111/Forge parameters text"""
    if not parameters_text or not isinstance(parameters_text, str):
        return {"prompt": "", "negative": "", "parameters": {}}
    
    # Fix unicode escaping issues
    parameters_text = parameters_text.encode('utf-8', 'ignore').decode('utf-8')
    
    lines = parameters_text.split('\n')
    
    # First line is usually the prompt
    prompt = lines[0].strip() if lines else ""
    
    # Look for negative prompt - handle both A1111 and Forge formats
    negative_prompt = ""
    negative_line_index = -1
    
    for i, line in enumerate(lines):
        if line.startswith('Negative prompt:'):
            negative_prompt = line.replace('Negative prompt:', '').strip()
            negative_line_index = i
            break
        elif i == 1 and line.strip() and not any(char in line for char in [':', '=', 'Steps', 'Sampler', 'CFG']):
            # Forge format: second line is negative prompt without prefix
            negative_prompt = line.strip()
            negative_line_index = i
            break
    
    # Parse parameters (everything after the prompts)
    parameters = {}
    start_parsing_params = negative_line_index + 1 if negative_line_index >= 0 else 1
    
    for line in lines[start_parsing_params:]:
        if line.strip() and ':' in line:
            parts = line.split(':', 1)
            if len(parts) == 2:
                key = parts[0].strip()
                value = parts[1].strip()
                parameters[key] = value
    
    return {
        "prompt": prompt,
        "negative": negative_prompt,
        "parameters": parameters
    }

# --- BOOKMARKS API ---

BOOKMARKS_FILE = 'bookmarks.json'

# Get bookmarks
@app.route('/api/bookmarks', methods=['GET'])
def get_bookmarks():
    try:
        if os.path.exists(BOOKMARKS_FILE):
            with open(BOOKMARKS_FILE, 'r', encoding='utf-8') as f:
                bookmarks = json.load(f)
        else:
            bookmarks = []
        return jsonify(bookmarks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Save bookmarks
@app.route('/api/bookmarks', methods=['POST'])
def save_bookmarks():
    try:
        bookmarks = request.json
        if not isinstance(bookmarks, list):
            return jsonify({"error": "Bookmarks must be an array"}), 400
        
        with open(BOOKMARKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(bookmarks, f, indent=2, ensure_ascii=False)
        
        return jsonify({"message": "Bookmarks saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- FOLDER NAVIGATION API ---

@app.route('/api/folders', methods=['GET'])
def list_folders():
    """List folders in the current directory"""
    try:
        folders = []
        files = []
        
        for item in os.listdir('.'):
            item_path = os.path.join('.', item)
            if os.path.isdir(item_path):
                folders.append(item)
            elif os.path.isfile(item_path):
                files.append(item)
        
        return jsonify({
            'folders': sorted(folders),
            'files': sorted(files)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/drives', methods=['GET'])
def list_drives():
    """List available drives on Windows"""
    try:
        import string
        drives = []
        
        # Check drives from A: to Z:
        for drive_letter in string.ascii_uppercase:
            drive_path = f"{drive_letter}:\\"
            if os.path.exists(drive_path):
                drives.append({
                    'letter': drive_letter,
                    'path': drive_path,
                    'name': f"{drive_letter}: Drive"
                })
        
        return jsonify(drives)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/files/<path:file_path>')
def serve_absolute_file(file_path):
    """Serve files from absolute paths"""
    try:
        # Security check
        if '..' in file_path:
            return jsonify({"error": "Invalid file path"}), 400
        
        # Handle absolute paths
        if file_path.startswith('/') or ':' in file_path:
            target_path = file_path
        else:
            target_path = os.path.join('.', file_path)
        
        if not os.path.exists(target_path):
            return jsonify({"error": "File not found"}), 404
        
        if not os.path.isfile(target_path):
            return jsonify({"error": "Not a file"}), 400
        
        # Disable caching for images
        response = make_response(send_from_directory(os.path.dirname(target_path), os.path.basename(target_path)))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/folders/<path:folder_path>', methods=['GET'])
def list_folder_contents(folder_path):
    """List contents of a specific folder"""
    try:
        # Security check to prevent directory traversal
        if '..' in folder_path:
            return jsonify({"error": "Invalid folder path"}), 400
        
        # Handle absolute paths (for drives like C:/, D:/, etc.)
        if folder_path.startswith('/') or ':' in folder_path:
            target_path = folder_path
        else:
            target_path = os.path.join('.', folder_path)
        
        if not os.path.exists(target_path):
            return jsonify({"error": "Folder not found"}), 404
        
        if not os.path.isdir(target_path):
            return jsonify({"error": "Not a directory"}), 400
        
        folders = []
        files = []
        
        for item in os.listdir(target_path):
            item_path = os.path.join(target_path, item)
            if os.path.isdir(item_path):
                folders.append(item)
            elif os.path.isfile(item_path):
                files.append(item)
        
        return jsonify({
            'path': folder_path,
            'folders': sorted(folders),
            'files': sorted(files),
            'absolute_path': target_path
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/folder-bookmarks', methods=['GET'])
def get_folder_bookmarks():
    """Get folder bookmarks"""
    try:
        if os.path.exists(BOOKMARKS_FILE):
            with open(BOOKMARKS_FILE, 'r', encoding='utf-8') as f:
                bookmarks = json.load(f)
        else:
            bookmarks = []
        
        # Filter to only folder bookmarks
        folder_bookmarks = [bm for bm in bookmarks if bm.get('type') == 'folder']
        return jsonify(folder_bookmarks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/folder-bookmarks', methods=['POST'])
def save_folder_bookmarks():
    """Save folder bookmarks"""
    try:
        folder_bookmarks = request.json
        
        if not isinstance(folder_bookmarks, list):
            return jsonify({"error": "Bookmarks must be an array"}), 400
        
        # Load existing bookmarks
        if os.path.exists(BOOKMARKS_FILE):
            with open(BOOKMARKS_FILE, 'r', encoding='utf-8') as f:
                all_bookmarks = json.load(f)
        else:
            all_bookmarks = []
        
        # Update folder bookmarks (keep non-folder bookmarks)
        updated_bookmarks = [
            bm for bm in all_bookmarks 
            if bm.get('type') != 'folder'
        ] + folder_bookmarks
        
        with open(BOOKMARKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(updated_bookmarks, f, indent=2, ensure_ascii=False)
        
        return jsonify({"message": "Folder bookmarks saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# File management endpoints for Explorer
@app.route('/api/explorer/rename-file', methods=['POST'])
def explorer_rename_file():
    """Rename a file"""
    try:
        data = request.json
        old_path = data.get('old_path')
        new_path = data.get('new_path')
        
        if not old_path or not new_path:
            return jsonify({"error": "Missing old_path or new_path"}), 400
        
        # Security check
        if '..' in old_path or '..' in new_path:
            return jsonify({"error": "Invalid path"}), 400
        
        # Handle absolute paths
        if old_path.startswith('/') or ':' in old_path:
            old_full_path = old_path
        else:
            old_full_path = os.path.join('.', old_path)
        
        if new_path.startswith('/') or ':' in new_path:
            new_full_path = new_path
        else:
            new_full_path = os.path.join('.', new_path)
        
        # Check if old file exists
        if not os.path.exists(old_full_path):
            return jsonify({"error": "File not found"}), 404
        
        # Check if new file already exists
        if os.path.exists(new_full_path):
            return jsonify({"error": "File with new name already exists"}), 400
        
        # Rename the file
        os.rename(old_full_path, new_full_path)
        
        return jsonify({"message": "File renamed successfully", "old_path": old_path, "new_path": new_path})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/explorer/delete-file', methods=['POST'])
def explorer_delete_file():
    """Delete a file"""
    try:
        data = request.json
        file_path = data.get('file_path')
        
        if not file_path:
            return jsonify({"error": "Missing file_path"}), 400
        
        # Security check
        if '..' in file_path:
            return jsonify({"error": "Invalid path"}), 400
        
        # Handle absolute paths
        if file_path.startswith('/') or ':' in file_path:
            full_path = file_path
        else:
            full_path = os.path.join('.', file_path)
        
        # Check if file exists
        if not os.path.exists(full_path):
            return jsonify({"error": "File not found"}), 404
        
        # Delete the file
        os.remove(full_path)
        
        return jsonify({"message": "File deleted successfully", "file_path": file_path})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Copy image to images folder
@app.route('/api/copy-image', methods=['POST'])
def copy_image():
    data = request.json
    source_path = data.get('source_path')
    destination_name = data.get('destination_name')
    
    if not source_path or not destination_name:
        return jsonify({"error": "Missing source_path or destination_name"}), 400
    
    try:
        # Security check to prevent directory traversal
        if '..' in source_path or '..' in destination_name:
            return jsonify({"error": "Invalid path"}), 400
        
        # Check if source file exists
        if not os.path.isfile(source_path):
            return jsonify({"error": "Source file not found"}), 404
        
        # Create images directory if it doesn't exist
        if not os.path.exists('images'):
            os.makedirs('images')
        
        # Copy the file
        destination_path = os.path.join('images', destination_name)
        
        # Handle case where destination file already exists
        if os.path.exists(destination_path):
            # Add a suffix to make it unique
            name, ext = os.path.splitext(destination_name)
            counter = 1
            while True:
                new_name = f"{name}_{counter}{ext}"
                new_path = os.path.join('images', new_name)
                if not os.path.exists(new_path):
                    destination_path = new_path
                    destination_name = new_name
                    break
                counter += 1
        
        # Copy the file
        import shutil
        shutil.copy2(source_path, destination_path)
        
        return jsonify({
            "success": True,
            "source_path": source_path,
            "destination_path": destination_path,
            "destination_name": destination_name
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to copy image: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)