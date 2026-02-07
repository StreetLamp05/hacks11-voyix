# Streamlit Inventory Dashboard

Interactive dashboard for real-time inventory management and analytics.

## Features
- 📊 Real-time inventory overview with KPIs
- 📈 Analytics and stock utilization charts
- ⚙️ Inventory management interface
- 🔴 Low stock alerts
- 📱 Responsive design

## Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Copy `.env.example` to `.env` and update with your backend URL:
```bash
cp .env.example .env
```

### 3. Run the Dashboard
```bash
streamlit run app.py
```

The dashboard will open at `http://localhost:8501`

## Project Structure
```
streamlit-frontend/
├── app.py                    # Main Streamlit application
├── requirements.txt          # Python dependencies
├── .env.example             # Environment variables template
└── .streamlit/
    └── config.toml          # Streamlit configuration
```

## Dependencies
- **streamlit**: Web app framework
- **pandas**: Data manipulation
- **plotly**: Interactive visualizations
- **requests**: API calls to backend
- **python-dotenv**: Environment variable management

## Next Steps
1. Update `load_inventory_data()` function to call your backend API
2. Implement authentication if needed
3. Add more custom charts and metrics
4. Connect to your database through the backend

## Troubleshooting
- Port already in use: `streamlit run app.py -- --server.port 8502`
- Backend connection issues: Check `BACKEND_URL` in `.env`
- Missing dependencies: Run `pip install -r requirements.txt` again
