import os

css_files = [
    r'c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule\payments\pages\pay-slips\pay-slips.component.css',
    r'c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule\payments\pages\payment-method\payment-method.component.css',
    r'c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule\document-management\pages\create-doc-structure\create-doc-structure.component.css',
    r'c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule\document-management\pages\search-documents\search-documents.component.css',
    r'c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule\document-management\pages\upload-documents\upload-documents.component.css'
]

managerial_css = """

/* === MANAGERIAL PREMIUM THEME === */
.premium-card {
  border-radius: 16px !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02) !important;
  border: 1px solid #f1f5f9;
  background-color: #ffffff;
  overflow: hidden;
  margin-bottom: 24px;
}

.card-header-premium {
  display: flex;
  align-items: center;
  padding: 24px 32px 20px 32px !important;
  border-bottom: none;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%);
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  margin-bottom: 20px;
}

.card-header-premium::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(140, 213, 10, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 48px;
  width: 48px;
  height: 48px;
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-radius: 12px;
}

.header-icon {
  font-size: 28px;
  width: 28px;
  height: 28px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.titulo {
  font-family: 'Inter', 'Roboto', sans-serif;
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  color: #ffffff;
  margin: 0 0 2px 0 !important;
  letter-spacing: -0.01em;
}

.subtitulo {
  font-family: 'Inter', 'Roboto', sans-serif;
  font-size: 0.85rem !important;
  color: #cbd5e1 !important;
  margin: 0 !important;
}

.grow {
  flex: 1 1 auto;
}

.btn-managerial {
  background-color: #192030 !important;
  color: #8DD603 !important;
  border-radius: 8px !important;
  padding: 0 20px !important;
  height: 40px !important;
  font-weight: 600 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.2s ease !important;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-managerial:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.25) !important;
  background-color: #8DD603 !important;
  color: #192030 !important;
}
"""

for path in css_files:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'MANAGERIAL PREMIUM THEME' not in content:
            with open(path, 'a', encoding='utf-8') as f:
                f.write(managerial_css)
            print(f"Appended styles to: {path}")
        else:
            print(f"Styles already exist in: {path}")
