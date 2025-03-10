document.getElementById("regform").addEventListener("submit", async(event) => {
    event.preventDefault();

    const firstname = document.getElementById("firstname").value;
    const lastname = document.getElementById("lastname").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try{
        const response = await fetch("http://localhost:3000/auth/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                firstname, 
                lastname,
                username,
                password
            })
        })

        const data = await response.json();

        if(response.ok){
            window.location.href = data.redirectURL;
        } else{
            alert(data.message);
        }
        
    } catch(err){
        console.log("Registration Failed: ", err);
        alert("Something went wrong");
    }
})
