"""
Test client for Restaurant Inventory Restock API
Demonstrates how to interact with the API endpoints

Author: Generated for UGA Hacks  
Date: February 7, 2026
"""

import requests
import json
import time
from datetime import datetime
import psycopg2
import pandas as pd

# API base URL
BASE_URL = "http://localhost:8001"

def test_health_check():
    """Test the health check endpoint"""
    print("🏥 Testing health check...")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Status: {data['status']}")
            print(f"📊 Model Loaded: {data['model_loaded']}")
            if data.get('model_accuracy'):
                print(f"🎯 Model Accuracy: {data['model_accuracy']:.4f}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.ConnectionError:
        print("❌ Cannot connect to API - is the server running?")
        return False

def test_database_connection():
    """Test PostgreSQL database connection"""
    print("\n🗄️  Testing database connection...")
    
    try:
        conn = psycopg2.connect('postgresql://hacks11:hackers11@10.0.0.27:5432/inventory_health')
        print("✅ Connection successful!")
        
        # Test a simple query to verify the connection works
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        db_version = cursor.fetchone()
        print(f"📊 Connected to: {db_version[0][:50]}...")
        
        cursor.close()
        conn.close()
        print("✅ Database connection closed properly")
        return True
        
    except psycopg2.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Database test error: {e}")
        return False

def test_database_data():
    """Test querying actual data from the database and loading into pandas"""
    print("\n📊 Testing database data query...")
    
    try:
        # Use SQLAlchemy connection string for pandas compatibility
        from sqlalchemy import create_engine
        engine = create_engine('postgresql://hacks11:hackers11@10.0.0.27:5432/inventory_health')
        print("✅ Connected to database for data query")
        
        # First, let's see what tables are available
        tables_query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """
        tables_df = pd.read_sql_query(tables_query, engine)
        table_names = tables_df['table_name'].tolist()
        print(f"📋 Available tables: {table_names}")
        
        # Try to query from the most promising tables
        successful_queries = []
        
        for table_name in table_names[:3]:  # Try first 3 tables
            try:
                print(f"🔍 Trying to query {table_name} table...")
                query = f"SELECT * FROM {table_name} LIMIT 5;"
                df = pd.read_sql_query(query, engine)
                
                if len(df) > 0:
                    print(f"✅ Successfully queried {table_name} table!")
                    print(f"📊 Shape: {df.shape} (rows, columns)")
                    print(f"📋 Columns: {list(df.columns)}")
                    print("\n📄 Sample data:")
                    print(df.to_string(index=False))
                    print()
                    successful_queries.append(table_name)
                    
                    # Only show detailed info for first successful table
                    if len(successful_queries) == 1:
                        print(f"🔢 Data types:")
                        for col, dtype in df.dtypes.items():
                            print(f"  {col}: {dtype}")
                        
                        numeric_cols = df.select_dtypes(include=['number']).columns
                        if len(numeric_cols) > 0:
                            print(f"\n📈 Numeric column stats:")
                            print(df[numeric_cols].describe().to_string())
                    
                    break  # Stop after first successful query for brevity
                    
            except Exception as e:
                print(f"⚠️ Could not query {table_name}: {str(e)[:60]}...")
                continue
        
        if successful_queries:
            print(f"\n✅ Successfully queried data from: {', '.join(successful_queries)}")
        else:
            print("\n⚠️ No data could be retrieved from available tables")
        
        engine.dispose()
        print("✅ Database connection closed properly")
        return True
        
    except ImportError:
        print("❌ SQLAlchemy not available, trying direct psycopg2 connection...")
        return test_database_data_direct()
    except Exception as e:
        print(f"❌ Database data query error: {e}")
        return False

def test_database_data_direct():
    """Fallback method using direct psycopg2 connection"""
    try:
        conn = psycopg2.connect('postgresql://hacks11:hackers11@10.0.0.27:5432/inventory_health')
        cursor = conn.cursor()
        
        # Get table names
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        print(f"📋 Available tables: {table_names}")
        
        # Try to query a simple table
        if table_names:
            table_name = table_names[0]
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
            rows = cursor.fetchall()
            
            # Get column names
            cursor.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{table_name}'
                ORDER BY ordinal_position;
            """)
            columns_info = cursor.fetchall()
            column_names = [col[0] for col in columns_info]
            
            print(f"\n📊 Sample data from {table_name}:")
            print(f"📋 Columns: {column_names}")
            if rows:
                # Convert to pandas DataFrame manually
                df = pd.DataFrame(rows, columns=column_names)
                print("\n📄 Data:")
                print(df.to_string(index=False))
            else:
                print("📄 No data found in table")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Direct database query error: {e}")
        return False

def test_categories_endpoint():
    """Test the categories information endpoint"""
    print("\n📋 Testing categories endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/categories")
        if response.status_code == 200:
            data = response.json()
            print("✅ Categories loaded:")
            for category, info in data['categories'].items():
                print(f"  • {category}: {info['shelf_life_days']} days shelf life, "
                      f"{info['delivery_frequency_days']} days delivery cycle")
            return True
        else:
            print(f"❌ Categories endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Categories test error: {e}")
        return False

def test_single_ingredient():
    """Test single ingredient prediction"""
    print("\n🥗 Testing single ingredient prediction...")
    
    # Sample ingredient data
    ingredient_data = {
        "ingredient_id": "CHICKEN_001",
        "ingredient_name": "Chicken Breast",
        "inventory_start": 50.0,
        "qty_used": 12.5,
        "on_order_qty": 0.0,
        "lead_time_days": 2,
        "covers": 120,
        "seasonality_factor": 1.1,
        "is_holiday": False
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/restock/predict-single",
            json=ingredient_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data['success']:
                rec = data['recommendation']
                print(f"✅ Prediction for {rec['ingredient_name']}:")
                print(f"  📊 Category: {rec['category']}")
                print(f"  ⚠️ Priority: {rec['priority']}")
                print(f"  📦 Current Stock: {rec['current_inventory']:.1f}")
                print(f"  🔮 Predicted End: {rec['predicted_inventory_end']:.1f}")
                print(f"  🛒 Restock Needed: {rec['restock_needed']}")
                if rec['restock_needed']:
                    print(f"  📋 Suggested Order: {rec['suggested_order_qty']:.1f}")
                    print(f"  📅 Days Until Stockout: {rec['days_until_stockout']:.1f}")
                print(f"  ⏱️ Processing Time: {data['processing_time_ms']:.1f}ms")
                return True
            else:
                print(f"❌ Prediction failed: {data.get('message', 'Unknown error')}")
                return False
        else:
            print(f"❌ Single ingredient test failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Single ingredient test error: {e}")
        return False

def test_bulk_recommendations():
    """Test bulk restock recommendations"""
    print("\n📊 Testing bulk restock recommendations...")
    
    # Sample restaurant inventory data
    ingredients_data = {
        "ingredients": [
            {
                "ingredient_id": "CHICKEN_001",
                "ingredient_name": "Chicken Breast",
                "inventory_start": 25.0,
                "qty_used": 15.0,
                "covers": 150
            },
            {
                "ingredient_id": "LETTUCE_001",
                "ingredient_name": "Iceberg Lettuce",
                "inventory_start": 8.0,
                "qty_used": 6.5,
                "covers": 150
            },
            {
                "ingredient_id": "CHEESE_001", 
                "ingredient_name": "Mozzarella Cheese",
                "inventory_start": 40.0,
                "qty_used": 8.0,
                "covers": 150
            },
            {
                "ingredient_id": "RICE_001",
                "ingredient_name": "Basmati Rice",
                "inventory_start": 200.0,
                "qty_used": 12.0,
                "covers": 150
            }
        ],
        "priority_filter": ["CRITICAL", "HIGH", "MEDIUM"],
        "limit": 10
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/restock/recommendations",
            json=ingredients_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Bulk analysis completed:")
            print(f"  📊 Analyzed: {data['total_ingredients_analyzed']} ingredients")
            print(f"  💡 Recommendations: {data['recommendations_count']}")
            print(f"  ⏱️ Processing Time: {data['processing_time_ms']:.1f}ms")
            
            # Print summary
            summary = data['summary']
            print(f"\n📋 Priority Breakdown:")
            print(f"  🔴 Critical: {summary['critical']}")
            print(f"  🟡 High: {summary['high']}") 
            print(f"  🟢 Medium: {summary['medium']}")
            print(f"  ⚪ Low: {summary['low']}")
            print(f"  🛒 Need Restock: {summary['restock_needed']}")
            print(f"  ⚠️ Waste Risk: {summary['waste_risk']}")
            
            # Show top recommendations
            print(f"\n🎯 Top Recommendations:")
            for i, rec in enumerate(data['recommendations'][:3], 1):
                print(f"  {i}. {rec['ingredient_name']} ({rec['category']})")
                print(f"     Priority: {rec['priority']}, Stock: {rec['current_inventory']:.1f}")
                if rec['restock_needed']:
                    print(f"     📦 Order: {rec['suggested_order_qty']:.1f}")
                
            return True
        else:
            print(f"❌ Bulk recommendations failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Bulk recommendations test error: {e}")
        return False

def run_all_tests():
    """Run all API tests"""
    print("🚀 Starting Restaurant Restock API Tests")
    print("=" * 50)
    
    # Track test results
    results = []
    
    # Test health check first
    results.append(("Health Check", test_health_check()))
    
    # Test database connection
    time.sleep(1)
    results.append(("Database Connection", test_database_connection()))
    
    # Test database data query
    time.sleep(1)
    results.append(("Database Data Query", test_database_data()))
    
    if not results[0][1]:  # If health check fails, skip other tests
        print("\n❌ Health check failed - skipping other tests")
        print("💡 Make sure to start the API server first:")
        print("   python restaurant_api.py")
        return
    
    # Run other tests
    time.sleep(1)  # Brief delay between tests
    results.append(("Categories", test_categories_endpoint()))
    
    time.sleep(1) 
    results.append(("Single Ingredient", test_single_ingredient()))
    
    time.sleep(1)
    results.append(("Bulk Recommendations", test_bulk_recommendations()))
    
    # Print final results
    print("\n" + "=" * 50)
    print("🏁 Test Results Summary:")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name}")
    
    print(f"\n📊 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your API is ready to use.")
        print("\n🔗 Try the interactive docs at: http://localhost:8000/docs")
    else:
        print("⚠️  Some tests failed - check the API server logs")

if __name__ == "__main__":
    run_all_tests()