# jules-scratch/verification/verify_campaign_fix.py
from playwright.sync_api import sync_playwright, expect
import os
import tempfile

def main():
    user_data_dir = tempfile.mkdtemp()
    extension_path = os.path.abspath('.')

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=True,
            args=[
                # Use the new headless mode for Chromium
                '--headless=new',
                f'--disable-extensions-except={extension_path}',
                f'--load-extension={extension_path}',
            ],
            slow_mo=100,  # Add a small delay to improve stability
        )

        try:
            # Use the default page or create a new one
            page = context.pages[0] if context.pages else context.new_page()

            # Navigate to a valid search page where content scripts will run
            page.goto("https://www.trendyol.com/sr?q=laptop", timeout=60000)

            # Handle the cookie consent dialog first
            cookie_accept_button = page.locator('#onetrust-accept-btn-handler')
            if cookie_accept_button.is_visible():
                cookie_accept_button.click()

            # Wait for the BR.panel object to be ready, indicating scripts have loaded
            page.wait_for_function("!!window.BR?.panel", timeout=15000)

            # Use the background script to toggle the panel to avoid race conditions
            context.background_pages[0].evaluate('chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_PANEL" }); });')

            # Wait for the debug panel to become visible
            debug_panel = page.locator('#br-debug')
            expect(debug_panel).to_be_visible(timeout=10000)

            # Locate and click the button that executes our test
            run_test_button = page.get_by_role("button", name="▶️ Run Campaign Filter Test")
            expect(run_test_button).to_be_visible(timeout=5000)
            run_test_button.click()

            # Verify that the test passed by checking for the success log message
            success_log = page.locator(".tst-log-line:has-text('All assertions passed.')")
            expect(success_log).to_be_visible(timeout=10000)

            # Capture a screenshot of the panel with the successful test log for verification
            page.locator('#br-panel').screenshot(path="jules-scratch/verification/verification.png")
            print("Verification screenshot saved to jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            # On failure, capture the full page to aid in debugging
            page.screenshot(path="jules-scratch/verification/error.png")
            print("Error screenshot saved to jules-scratch/verification/error.png")
            # Propagate the error to indicate script failure
            raise
        finally:
            context.close()

if __name__ == "__main__":
    main()