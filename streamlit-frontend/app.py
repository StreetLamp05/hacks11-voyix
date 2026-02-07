import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="Inventory Dashboard",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom styling
st.markdown("""
    <style>
    .metric-card {
        background-color: #f0f2f6;
        padding: 20px;
        border-radius: 10px;
        margin: 10px 0;
    }
    </style>
""", unsafe_allow_html=True)

# Sidebar configuration
st.sidebar.title("⚙️ Settings")
backend_url = st.sidebar.text_input(
    "Backend URL",
    value=os.getenv("BACKEND_URL", "http://localhost:5000"),
    help="URL of the backend API"
)

# Main title
st.title("📦 Inventory Dashboard")
st.markdown("Real-time inventory tracking and analytics")

# Sample data (replace with actual API calls)
@st.cache_data
def load_inventory_data():
    # This will be replaced with actual API call to backend
    data = {
        "Product ID": ["PROD001", "PROD002", "PROD003", "PROD004", "PROD005"],
        "Product Name": ["Widget A", "Widget B", "Gadget X", "Gadget Y", "Tool Z"],
        "Current Stock": [150, 75, 200, 45, 320],
        "Min Stock": [50, 30, 100, 20, 100],
        "Max Stock": [500, 300, 600, 200, 800],
        "Category": ["Electronics", "Electronics", "Gadgets", "Gadgets", "Tools"],
        "Last Updated": pd.date_range("2026-01-01", periods=5, freq="D")
    }
    return pd.DataFrame(data)

# Load data
inventory_df = load_inventory_data()

# KPI Metrics
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(
        label="Total Items",
        value=inventory_df["Current Stock"].sum(),
        delta="+12"
    )

with col2:
    st.metric(
        label="Low Stock Items",
        value=len(inventory_df[inventory_df["Current Stock"] < inventory_df["Min Stock"]]),
        delta="-2"
    )

with col3:
    st.metric(
        label="Categories",
        value=inventory_df["Category"].nunique()
    )

with col4:
    st.metric(
        label="Total Products",
        value=len(inventory_df)
    )

st.divider()

# Tabs for different views
tab1, tab2, tab3 = st.tabs(["📊 Overview", "📈 Analytics", "⚙️ Management"])

# Tab 1: Overview
with tab1:
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("Stock Levels by Product")
        fig = go.Figure()
        fig.add_trace(go.Bar(
            name="Current Stock",
            x=inventory_df["Product Name"],
            y=inventory_df["Current Stock"],
            marker_color="lightblue"
        ))
        fig.add_trace(go.Scatter(
            name="Min Stock",
            x=inventory_df["Product Name"],
            y=inventory_df["Min Stock"],
            mode="lines",
            line=dict(color="red", dash="dash")
        ))
        fig.update_layout(
            hovermode="x unified",
            height=400,
            showlegend=True
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("Stock Status")
        for _, row in inventory_df.iterrows():
            status = "🟢" if row["Current Stock"] >= row["Min Stock"] else "🔴"
            st.markdown(f"{status} {row['Product Name']}: {row['Current Stock']}")

# Tab 2: Analytics
with tab2:
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Stock by Category")
        category_stock = inventory_df.groupby("Category")["Current Stock"].sum()
        fig = go.Figure(data=[
            go.Pie(
                labels=category_stock.index,
                values=category_stock.values,
                hole=0.3
            )
        ])
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("Stock Utilization")
        inventory_df["Utilization %"] = (
            inventory_df["Current Stock"] / inventory_df["Max Stock"] * 100
        ).round(2)
        fig = go.Figure(data=[
            go.Bar(
                x=inventory_df["Product Name"],
                y=inventory_df["Utilization %"],
                marker_color="mediumpurple"
            )
        ])
        fig.update_layout(height=400)
        st.plotly_chart(fig, use_container_width=True)

# Tab 3: Management
with tab3:
    st.subheader("Inventory Table")
    
    # Display editable dataframe
    edited_df = st.data_editor(
        inventory_df[["Product Name", "Current Stock", "Min Stock", "Max Stock", "Category"]],
        use_container_width=True,
        hide_index=True
    )
    
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("💾 Save Changes", use_container_width=True):
            st.success("Changes saved successfully!")
    
    with col2:
        if st.button("🔄 Refresh Data", use_container_width=True):
            st.cache_data.clear()
            st.rerun()

# Footer
st.divider()
st.markdown("""
    <div style='text-align: center; color: gray; margin-top: 30px;'>
    <small>Inventory Dashboard v1.0 | Connected to Backend: {}</small>
    </div>
""".format(backend_url), unsafe_allow_html=True)
