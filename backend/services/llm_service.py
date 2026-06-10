from google import genai

client = genai.Client(api_key="")

def get_llm_response(prompt):
    # 🔥 MOCK RESPONSE (temporary)
    return """
    [
      {
        "tool": "generate_offer_letter",
        "input": {
          "name": "John Doe",
          "salary": "5 LPA"
        }
      },
      {
        "tool": "store_employee",
        "input": {
          "name": "John Doe",
          "salary": "5 LPA"
        }
      }
    ]
    """