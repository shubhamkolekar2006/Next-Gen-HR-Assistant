from app.services.langchain_orchestrator import orchestrate
from app.core.database import connect_to_mongo
import asyncio

def main():
    print("\n" + "="*50)
    print(" HR AI Assistant (Terminal Chatbot)")
    print("Type 'exit' or 'quit' to stop")
    print("="*50 + "\n")

    while True:
        try:
            user_input = input(" You: ").strip()

            if user_input.lower() in ["exit", "quit"]:
                print("\n Goodbye! See you again.\n")
                break

            if not user_input:
                continue

            print("\n Thinking...\n")

            result = orchestrate(user_input)

            if result["status"] == "success":
                print(" Assistant:", result["response"], "\n")
            else:
                print(" Error:", result["response"], "\n")

        except KeyboardInterrupt:
            print("\n\n Chat terminated by user.\n")
            break
        except Exception as e:
            print(f"\n Unexpected Error: {str(e)}\n")

if __name__ == "__main__":
    main()