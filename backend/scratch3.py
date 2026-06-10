import asyncio
from app.core.database import get_database, connect_to_mongo
import json

async def check():
    await connect_to_mongo()
    db = get_database()
    print("--- EMPLOYEES ---")
    emps = await db['employee'].find({'Status': 'Onboarding'}).to_list(length=5)
    for r in emps:
        print(r)
        
    print("\n--- ONBOARDING RECORDS ---")
    onbs = await db['Onboarding'].find().sort('_id', -1).to_list(length=5)
    for r in onbs:
        print(f"Employee Name: {r.get('employee_name')}")
        print(f"Employee Email: {r.get('employee_email')}")
        print(f"Plan: {json.dumps(r.get('plan', {}))[:100]}...")

if __name__ == '__main__':
    asyncio.run(check())
