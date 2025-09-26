public class ErrorExample {
    public static void main(String[] args) {
        int number = "10";  // ❌ Error 1
        System.out.println("The number is: " + Number); // ❌ Error 2
        printMessage(); // ❌ Error 3
    }

    public void printMessage() {  // ❌ Error 4
        System.out.println("Hello from printMessage!");
    }
}
