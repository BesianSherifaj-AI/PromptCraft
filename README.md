# 🎨 PromptForge

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/flask-2.0+-lightgrey.svg)
![Tailwind](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)

**PromptForge** is a robust visual prompt management system designed for AI artists using workflows like **ComfyUI**, **Automatic1111**, and **Forge**. It streamlines the creative process by organizing artistic styles, camera angles, and materials into a visual catalog, allowing for rapid prompt construction and management.

## ✨ Features

- **Visual Catalog:** Browse your prompt library with large, clear image previews and detailed descriptions overlaid on hover.
- **Variant System:** Manage multiple iterations of a specific prompt (e.g., "Default", "Heavy Style", "Minimal") within a single card without cluttering your view.
- **Folder Explorer:** Integrated file browser to navigate local drives, preview images in a lightbox, and instantly turn local images into PromptForge cards.
- **Metadata Viewer:** Drag-and-drop support for analyzing AI-generated PNGs. Automatically extracts positive/negative prompts and generation parameters from ComfyUI, A1111, or Forge metadata.
- **Multi-Select Workspace:** Dedicated interface for selecting and combining multiple prompt cards into a single complex prompt string for easy copying.
- **Flexible Layouts:** Toggle between a standard **Vertical** grid or a column-based **Horizontal** layout optimized for widescreen workflows.
- **Category Management:** Organize styles into customizable pages and categories with intuitive drag-and-drop reordering.
- **Theming:** Built-in **Dark** and **Light** modes with persistent preference storage.
- **JSON-Based Storage:** All data is stored in human-readable local JSON files, ensuring easy backups and version control.

## 🛠️ Tech Stack

- **Backend:** Python 3 (Flask)
- **Frontend:** Vanilla JavaScript, HTML5
- **Styling:** Tailwind CSS (via CDN)
- **Image Processing:** Pillow (PIL)
- **Data Storage:** JSON (Local File System)

## 📋 Prerequisites

Before running PromptForge, ensure you have the following installed on your system:

- **Python 3.8** or higher
- **pip** (Python package installer)
- A modern web browser (Chrome, Firefox, Edge, etc.)

## 📦 Installation

1. **Clone the repository** or download the source code to your local machine.

2. **Install dependencies and start the server**
   Open your terminal or command prompt in the project root directory and run:

   **Standard:**

   ```bash
   pip install -r requirements.txt
   python app.py
   ```

   **Windows:**

   ```bash
   ./run_windows.sh
   ```

   **Linux / Mac:**

   ```bash
   ./run_mac
   ```

## 🚀 Usage

1. **Access the Application**
   Open your browser and navigate to `http://localhost:5000`.

2. **Managing Prompts**
   - **Add Page/Category:** Use the buttons in the header to structure your library.
   - **Create Prompt:** Click the `+` icon in a category header.
   - **Edit:** Hover over a card and click **Edit** to modify tags, descriptions, or add variants.
   - **Upload Images:** Drag and drop an image file directly onto a prompt card to set its preview.

3. **Using the Explorer**
   - Click **📁 Explorer** in the navigation bar.
   - Browse your local file system.
   - Click an image to open the Lightbox.
   - Click **🎨 Create Prompt** in the lightbox to import that image into your library immediately.

4. **Extracting Metadata**
   - Click **🖼️ Metadata** in the navigation bar.
   - Drag and drop any AI-generated PNG image to view its generation data.
   - Use the "Copy" buttons to grab positive or negative prompts.

## ⚙️ Configuration

The application is designed to run out-of-the-box with minimal configuration.

- **Port:** Defaults to `5000`. To change this, modify the `app.run` call at the bottom of `app.py`.
- **Data Storage:** Pages are stored as `.json` files in the root directory. Images are stored in the `/images` folder.
- **Bookmarks:** Folder bookmarks are stored in `bookmarks.json`.

## ⌨️ Keyboard Shortcuts

- `Ctrl + S` : Save all pages
- `Ctrl + F` : Focus the search bar
- `Esc` : Close active modals or lightbox
