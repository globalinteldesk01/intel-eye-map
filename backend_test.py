#!/usr/bin/env python3
"""
Intel Dashboard Backend API Test Suite
Tests all backend API endpoints for the Intel Dashboard news system.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from environment
BACKEND_URL = "https://instant-news-board.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.created_item_id = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "Intel-Dashboard-Test/1.0"}
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data if not success else None
        })
    
    async def test_root_endpoint(self):
        """Test GET /api/ - should return API status"""
        try:
            async with self.session.get(f"{BACKEND_URL}/") as response:
                data = await response.json()
                
                if response.status == 200:
                    if data.get("message") == "Intel Dashboard API" and data.get("status") == "operational":
                        self.log_test("GET /api/ - Root endpoint", True, "API status operational")
                    else:
                        self.log_test("GET /api/ - Root endpoint", False, f"Unexpected response format", data)
                else:
                    self.log_test("GET /api/ - Root endpoint", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("GET /api/ - Root endpoint", False, f"Request failed: {str(e)}")
    
    async def test_news_status(self):
        """Test GET /api/news/status - should return fetch status"""
        try:
            async with self.session.get(f"{BACKEND_URL}/news/status") as response:
                data = await response.json()
                
                if response.status == 200:
                    required_fields = ["is_fetching", "last_fetch_time", "total_items"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        self.log_test("GET /api/news/status", True, 
                                    f"Status: fetching={data['is_fetching']}, total={data['total_items']}")
                    else:
                        self.log_test("GET /api/news/status", False, 
                                    f"Missing fields: {missing_fields}", data)
                else:
                    self.log_test("GET /api/news/status", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("GET /api/news/status", False, f"Request failed: {str(e)}")
    
    async def test_get_news_basic(self):
        """Test GET /api/news?limit=5 - should return array of news items"""
        try:
            async with self.session.get(f"{BACKEND_URL}/news?limit=5") as response:
                data = await response.json()
                
                if response.status == 200:
                    if isinstance(data, list):
                        if len(data) > 0:
                            # Check first item has required fields
                            item = data[0]
                            required_fields = [
                                "id", "token", "title", "summary", "url", "source", 
                                "lat", "lon", "country", "category", "threat_level", 
                                "tags", "confidence_score"
                            ]
                            missing_fields = [field for field in required_fields if field not in item]
                            
                            if not missing_fields:
                                self.log_test("GET /api/news?limit=5", True, 
                                            f"Retrieved {len(data)} news items with all required fields")
                            else:
                                self.log_test("GET /api/news?limit=5", False, 
                                            f"Missing fields in news item: {missing_fields}", item)
                        else:
                            self.log_test("GET /api/news?limit=5", False, "No news items returned", data)
                    else:
                        self.log_test("GET /api/news?limit=5", False, "Response is not an array", data)
                else:
                    self.log_test("GET /api/news?limit=5", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("GET /api/news?limit=5", False, f"Request failed: {str(e)}")
    
    async def test_news_fetch_trigger(self):
        """Test POST /api/news/fetch - should trigger news fetch"""
        try:
            async with self.session.post(f"{BACKEND_URL}/news/fetch") as response:
                data = await response.json()
                
                if response.status == 200:
                    required_fields = ["success", "fetched", "inserted", "sources_checked"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        if data.get("success"):
                            self.log_test("POST /api/news/fetch", True, 
                                        f"Fetch triggered: {data['inserted']} inserted, {data['sources_checked']} sources")
                        else:
                            # Might be already fetching
                            self.log_test("POST /api/news/fetch", True, 
                                        f"Fetch response: {data.get('message', 'Already in progress')}")
                    else:
                        self.log_test("POST /api/news/fetch", False, 
                                    f"Missing fields: {missing_fields}", data)
                else:
                    self.log_test("POST /api/news/fetch", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("POST /api/news/fetch", False, f"Request failed: {str(e)}")
    
    async def test_news_filter_category(self):
        """Test GET /api/news?category=conflict - should filter by category"""
        try:
            async with self.session.get(f"{BACKEND_URL}/news?category=conflict&limit=10") as response:
                data = await response.json()
                
                if response.status == 200:
                    if isinstance(data, list):
                        if len(data) > 0:
                            # Check if all items have conflict category
                            non_conflict = [item for item in data if item.get("category") != "conflict"]
                            if not non_conflict:
                                self.log_test("GET /api/news?category=conflict", True, 
                                            f"Retrieved {len(data)} conflict news items")
                            else:
                                self.log_test("GET /api/news?category=conflict", False, 
                                            f"Found {len(non_conflict)} non-conflict items in results")
                        else:
                            self.log_test("GET /api/news?category=conflict", True, 
                                        "No conflict news items found (acceptable)")
                    else:
                        self.log_test("GET /api/news?category=conflict", False, "Response is not an array", data)
                else:
                    self.log_test("GET /api/news?category=conflict", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("GET /api/news?category=conflict", False, f"Request failed: {str(e)}")
    
    async def test_news_filter_threat_level(self):
        """Test GET /api/news?threat_level=high - should filter by threat level"""
        try:
            async with self.session.get(f"{BACKEND_URL}/news?threat_level=high&limit=10") as response:
                data = await response.json()
                
                if response.status == 200:
                    if isinstance(data, list):
                        if len(data) > 0:
                            # Check if all items have high threat level
                            non_high = [item for item in data if item.get("threat_level") != "high"]
                            if not non_high:
                                self.log_test("GET /api/news?threat_level=high", True, 
                                            f"Retrieved {len(data)} high threat news items")
                            else:
                                self.log_test("GET /api/news?threat_level=high", False, 
                                            f"Found {len(non_high)} non-high threat items in results")
                        else:
                            self.log_test("GET /api/news?threat_level=high", True, 
                                        "No high threat news items found (acceptable)")
                    else:
                        self.log_test("GET /api/news?threat_level=high", False, "Response is not an array", data)
                else:
                    self.log_test("GET /api/news?threat_level=high", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("GET /api/news?threat_level=high", False, f"Request failed: {str(e)}")
    
    async def test_create_news_item(self):
        """Test POST /api/news - should create a news item"""
        test_data = {
            "title": "Test Intel Report",
            "summary": "Test summary for intel item - security analysis of emerging threats",
            "source": "Test Source",
            "category": "security",
            "threat_level": "elevated",
            "country": "Global",
            "region": "Global",
            "lat": 0,
            "lon": 0,
            "tags": ["test", "security", "intel"],
            "confidence_score": 0.7,
            "confidence_level": "probable",
            "actor_type": "state",
            "url": "",
            "source_credibility": "medium"
        }
        
        try:
            async with self.session.post(f"{BACKEND_URL}/news", 
                                       json=test_data,
                                       headers={"Content-Type": "application/json"}) as response:
                data = await response.json()
                
                if response.status == 200:
                    if "id" in data and "title" in data:
                        self.created_item_id = data["id"]
                        self.log_test("POST /api/news", True, 
                                    f"Created news item with ID: {data['id']}")
                    else:
                        self.log_test("POST /api/news", False, "Missing id or title in response", data)
                else:
                    self.log_test("POST /api/news", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("POST /api/news", False, f"Request failed: {str(e)}")
    
    async def test_delete_news_item(self):
        """Test DELETE /api/news/{id} - delete the created item"""
        if not self.created_item_id:
            self.log_test("DELETE /api/news/{id}", False, "No item ID available for deletion")
            return
        
        try:
            async with self.session.delete(f"{BACKEND_URL}/news/{self.created_item_id}") as response:
                data = await response.json()
                
                if response.status == 200:
                    if data.get("success") and data.get("id") == self.created_item_id:
                        self.log_test("DELETE /api/news/{id}", True, 
                                    f"Successfully deleted item {self.created_item_id}")
                    else:
                        self.log_test("DELETE /api/news/{id}", False, "Unexpected response format", data)
                else:
                    self.log_test("DELETE /api/news/{id}", False, f"HTTP {response.status}", data)
        except Exception as e:
            self.log_test("DELETE /api/news/{id}", False, f"Request failed: {str(e)}")
    
    async def test_data_quality(self):
        """Test data quality - coordinates, threat levels, categories, minimum items"""
        try:
            async with self.session.get(f"{BACKEND_URL}/news?limit=50") as response:
                data = await response.json()
                
                if response.status != 200:
                    self.log_test("Data Quality Check", False, f"HTTP {response.status}")
                    return
                
                if not isinstance(data, list):
                    self.log_test("Data Quality Check", False, "Response is not an array")
                    return
                
                if len(data) < 10:
                    self.log_test("Data Quality Check", False, 
                                f"Only {len(data)} news items found, expected at least 10")
                    return
                
                # Check coordinates (not all zeros)
                items_with_coords = [item for item in data 
                                   if item.get("lat", 0) != 0 or item.get("lon", 0) != 0]
                coord_percentage = len(items_with_coords) / len(data) * 100
                
                # Check threat levels
                valid_threat_levels = {"critical", "high", "elevated", "low"}
                items_with_valid_threat = [item for item in data 
                                         if item.get("threat_level") in valid_threat_levels]
                threat_percentage = len(items_with_valid_threat) / len(data) * 100
                
                # Check categories
                valid_categories = {"security", "conflict", "diplomacy", "economy", "humanitarian", "technology"}
                items_with_valid_category = [item for item in data 
                                           if item.get("category") in valid_categories]
                category_percentage = len(items_with_valid_category) / len(data) * 100
                
                # Check RSS feed sources (not manual)
                rss_sources = [item for item in data if item.get("source") != "Manual"]
                rss_percentage = len(rss_sources) / len(data) * 100
                
                issues = []
                if coord_percentage < 50:
                    issues.append(f"Only {coord_percentage:.1f}% have proper coordinates")
                if threat_percentage < 95:
                    issues.append(f"Only {threat_percentage:.1f}% have valid threat levels")
                if category_percentage < 95:
                    issues.append(f"Only {category_percentage:.1f}% have valid categories")
                if rss_percentage < 80:
                    issues.append(f"Only {rss_percentage:.1f}% from RSS feeds")
                
                if issues:
                    self.log_test("Data Quality Check", False, "; ".join(issues))
                else:
                    self.log_test("Data Quality Check", True, 
                                f"Good data quality: {len(data)} items, {coord_percentage:.1f}% with coords, "
                                f"{threat_percentage:.1f}% valid threats, {category_percentage:.1f}% valid categories")
                
        except Exception as e:
            self.log_test("Data Quality Check", False, f"Request failed: {str(e)}")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 Intel Dashboard Backend API Test Suite")
        print("=" * 50)
        print(f"Testing backend at: {BACKEND_URL}")
        print()
        
        # Run tests in order
        await self.test_root_endpoint()
        await self.test_news_status()
        await self.test_get_news_basic()
        await self.test_news_fetch_trigger()
        await self.test_news_filter_category()
        await self.test_news_filter_threat_level()
        await self.test_create_news_item()
        await self.test_delete_news_item()
        await self.test_data_quality()
        
        # Summary
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print("=" * 50)
        print(f"📊 Test Summary: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed!")
            return True
        else:
            print("❌ Some tests failed:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   - {result['test']}: {result['details']}")
            return False

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        success = await tester.run_all_tests()
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)