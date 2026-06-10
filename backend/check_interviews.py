#!/usr/bin/env python
"""
Quick script to check Interviews collection in MongoDB
Run: python check_interviews.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_database
from bson import ObjectId
import json

async def check_interviews():
    """Check Interviews collection structure"""
    db = get_database()
    
    print("=" * 60)
    print("CHECKING INTERVIEWS COLLECTION IN MONGODB")
    print("=" * 60)
    
    # Get total count
    count = await db["Interviews"].count_documents({})
    print(f"\nTotal interviews in collection: {count}\n")
    
    if count == 0:
        print("No interviews found in the collection!")
        return
    
    # Get first 5 interviews
    interviews = await db["Interviews"].find({}).limit(5).to_list(length=5)
    
    for i, interview in enumerate(interviews, 1):
        print(f"\n{'='*60}")
        print(f"INTERVIEW #{i}")
        print(f"{'='*60}")
        print(f"_id: {interview.get('_id')}")
        print(f"\nAll fields in this interview:")
        print("-" * 60)
        
        # Show all fields
        for key, value in interview.items():
            value_str = str(value)
            if len(value_str) > 100:
                value_str = value_str[:100] + "..."
            print(f"  {key:20s} = {value_str:50s} (type: {type(value).__name__})")
        
        # Check for ID fields specifically
        print(f"\nID-related fields:")
        print("-" * 60)
        id_fields = ["InterviewID", "interviewID", "interview_id", "Interview_Id", "ID", "id"]
        found_id_fields = False
        for field in id_fields:
            if field in interview:
                found_id_fields = True
                print(f"  ✓ {field:20s} = '{interview[field]}' (type: {type(interview[field]).__name__})")
        
        if not found_id_fields:
            print("  ✗ No ID-related fields found!")
    
    # Test lookup for "I001"
    print(f"\n{'='*60}")
    print("TESTING LOOKUP FOR 'I001'")
    print(f"{'='*60}")
    
    test_id = "I001"
    print(f"\nSearching for InterviewID = '{test_id}':")
    
    # Try different field names
    for field_name in ["InterviewID", "interviewID", "interview_id", "Interview_Id"]:
        result = await db["Interviews"].find_one({field_name: test_id})
        if result:
            print(f"  ✓ FOUND using field '{field_name}': _id = {result.get('_id')}")
        else:
            print(f"  ✗ Not found using field '{field_name}'")
    
    # Try case-insensitive
    import re
    regex_result = await db["Interviews"].find_one({
        "InterviewID": {"$regex": f"^{re.escape(test_id)}$", "$options": "i"}
    })
    if regex_result:
        print(f"  ✓ FOUND using case-insensitive regex: _id = {regex_result.get('_id')}")
    else:
        print(f"  ✗ Not found using case-insensitive regex")
    
    # Show all unique InterviewID values if the field exists
    print(f"\n{'='*60}")
    print("ALL UNIQUE InterviewID VALUES (if field exists)")
    print(f"{'='*60}")
    
    all_interviews = await db["Interviews"].find({}).to_list(length=None)
    interview_ids = set()
    for interview in all_interviews:
        for field in ["InterviewID", "interviewID", "interview_id"]:
            if field in interview:
                interview_ids.add((field, str(interview[field])))
    
    if interview_ids:
        for field, value in sorted(interview_ids):
            print(f"  {field:20s} = '{value}'")
    else:
        print("  ✗ No InterviewID field found in any interview!")

if __name__ == "__main__":
    asyncio.run(check_interviews())

