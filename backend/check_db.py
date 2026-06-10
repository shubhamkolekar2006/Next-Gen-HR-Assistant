#!/usr/bin/env python
"""
Quick script to check what's actually in the Interviews collection
Run: python check_db.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def check_db():
    """Check Interviews collection directly"""
    try:
        from app.core.database import get_database
        
        db = get_database()
        
        print("=" * 70)
        print("CHECKING INTERVIEWS COLLECTION")
        print("=" * 70)
        
        # Get first interview
        interview = await db["Interviews"].find_one({})
        
        if not interview:
            print("\n❌ No interviews found in the collection!")
            return
        
        print(f"\n✅ Found interview with _id: {interview.get('_id')}")
        print("\n" + "=" * 70)
        print("ALL FIELDS IN THIS INTERVIEW:")
        print("=" * 70)
        
        # Show all fields
        for key, value in sorted(interview.items()):
            value_str = str(value)
            if len(value_str) > 60:
                value_str = value_str[:60] + "..."
            print(f"  {key:25s} = {value_str}")
        
        print("\n" + "=" * 70)
        print("CHECKING FOR InterviewID FIELD:")
        print("=" * 70)
        
        # Check for InterviewID specifically
        id_fields = ["InterviewID", "interviewID", "interview_id", "Interview_Id", "ID", "id"]
        found = False
        for field in id_fields:
            if field in interview:
                found = True
                print(f"  ✅ Found field '{field}' = '{interview[field]}' (type: {type(interview[field]).__name__})")
        
        if not found:
            print("  ❌ No InterviewID field found!")
            print("\n  Available fields are:")
            for key in sorted(interview.keys()):
                print(f"    - {key}")
        
        # Test lookup for "I001"
        print("\n" + "=" * 70)
        print("TESTING LOOKUP FOR 'I001':")
        print("=" * 70)
        
        test_id = "I001"
        
        # Try direct lookup
        result = await db["Interviews"].find_one({"InterviewID": test_id})
        if result:
            print(f"  ✅ FOUND using InterviewID='{test_id}': _id = {result.get('_id')}")
        else:
            print(f"  ❌ NOT FOUND using InterviewID='{test_id}'")
        
        # Show all InterviewID values in database
        print("\n" + "=" * 70)
        print("ALL InterviewID VALUES IN DATABASE:")
        print("=" * 70)
        
        all_interviews = await db["Interviews"].find({}).to_list(length=None)
        interview_ids = []
        for i in all_interviews:
            for field in ["InterviewID", "interviewID", "interview_id"]:
                if field in i:
                    interview_ids.append((str(i.get("_id")), field, str(i.get(field))))
        
        if interview_ids:
            for obj_id, field, value in interview_ids:
                print(f"  _id: {obj_id[:20]}... | {field} = '{value}'")
        else:
            print("  ❌ No InterviewID field found in any interview!")
            print("\n  Checking what ID-related fields exist...")
            for i in all_interviews[:3]:
                print(f"\n  Interview _id: {i.get('_id')}")
                for key in sorted(i.keys()):
                    if 'id' in key.lower() or 'ID' in key:
                        print(f"    - {key} = {i.get(key)}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_db())

