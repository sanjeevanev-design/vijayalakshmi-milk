"use strict";

/* =========================================================
   FIREBASE PIN LOGIN
========================================================= */

/* Replace these values with the Firebase Web App configuration. */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDQOiB7qw7QpqZOOKXRd1ojk_5ogbNo2zY",
    authDomain: "vijaylakshmi-milk.firebaseapp.com",
    projectId: "vijaylakshmi-milk",
    storageBucket: "vijaylakshmi-milk.firebasestorage.app",
    messagingSenderId: "979697893607",
    appId: "1:979697893607:web:f4e4e455cbdbd7a7f4a242"
};

let firebaseAuth = null;
let loginAttempts = 0;
let loginLockedUntil = 0;

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const LOGIN_SECURITY_STORAGE_KEY = "vijayalakshmi_login_security";

function readLoginSecurity(){
    try{
        const saved = JSON.parse(
            localStorage.getItem(LOGIN_SECURITY_STORAGE_KEY) || "{}"
        );

        return {
            attempts:Number.isInteger(saved.attempts) && saved.attempts >= 0
                ? saved.attempts
                : 0,
            lockedUntil:Number.isFinite(Number(saved.lockedUntil))
                ? Number(saved.lockedUntil)
                : 0
        };
    }catch(error){
        return {attempts:0,lockedUntil:0};
    }
}

function writeLoginSecurity(security){
    try{
        localStorage.setItem(
            LOGIN_SECURITY_STORAGE_KEY,
            JSON.stringify(security)
        );
    }catch(error){
        console.warn("Could not save login security state.",error);
    }
}

function clearLoginSecurity(){
    loginAttempts = 0;
    loginLockedUntil = 0;

    try{
        localStorage.removeItem(LOGIN_SECURITY_STORAGE_KEY);
    }catch(error){
        console.warn("Could not clear login security state.",error);
    }
}

function formatLockTime(milliseconds){
    const totalHours = Math.ceil(milliseconds / (60 * 60 * 1000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if(days > 0){
        return `${days} day${days === 1 ? "" : "s"}${hours ? ` and ${hours} hour${hours === 1 ? "" : "s"}` : ""}`;
    }

    return `${Math.max(1,hours)} hour${hours === 1 ? "" : "s"}`;
}

function firebaseConfigured(){
    return FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY" &&
        FIREBASE_CONFIG.projectId !== "YOUR_FIREBASE_PROJECT_ID";
}

function showLoginError(message){
    const error = document.getElementById("loginError");
    if(!error) return;
    error.textContent = message;
    error.classList.remove("hidden");
}

async function verifyLogin(event){
    event.preventDefault();

    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const button = document.getElementById("loginButton");
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const now = Date.now();

    const savedSecurity = readLoginSecurity();
    loginAttempts = savedSecurity.attempts;
    loginLockedUntil = savedSecurity.lockedUntil;

    if(loginLockedUntil > now){
        showLoginError(
            `Sign-in is locked for ${formatLockTime(loginLockedUntil - now)} ` +
            `because of repeated incorrect email or password entries.`
        );
        return;
    }

    if(loginLockedUntil && loginLockedUntil <= now){
        clearLoginSecurity();
    }

    if(!email || !password){
        showLoginError("Enter your email and password.");
        return;
    }

    if(!firebaseAuth){
        showLoginError("Firebase Authentication is not available.");
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="bi bi-hourglass-split"></i> Signing in...';

    try{
        await firebaseAuth.signInWithEmailAndPassword(email,password);
        clearLoginSecurity();
        document.getElementById("loginGate").remove();
        document.getElementById("appShell").classList.remove("app-locked");
        init();
    }catch(error){
        console.error("Firebase sign-in failed:",error);
        loginAttempts++;

        if(loginAttempts >= LOGIN_MAX_ATTEMPTS){
            loginLockedUntil = Date.now() + LOGIN_LOCK_DURATION_MS;
            writeLoginSecurity({
                attempts:loginAttempts,
                lockedUntil:loginLockedUntil
            });
            passwordInput.value = "";
            showLoginError(
                "Sign-in locked for 3 days after 5 incorrect attempts."
            );
            return;
        }

        writeLoginSecurity({
            attempts:loginAttempts,
            lockedUntil:0
        });
        passwordInput.value = "";

        const authMessage = {
            "auth/invalid-credential":"The email or password is incorrect.",
            "auth/user-not-found":"No Firebase account exists for this email.",
            "auth/wrong-password":"The email or password is incorrect.",
            "auth/invalid-email":"Enter a valid email address.",
            "auth/user-disabled":"This Firebase account has been disabled.",
            "auth/too-many-requests":"Too many attempts. Try again later."
        }[error?.code] || "Could not sign in. Check your Firebase account details.";

        showLoginError(authMessage);
    }finally{
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Sign In';
    }
}

function initializeLogin(){
    if(!firebaseConfigured()){
        showLoginError("Add your Firebase configuration in script.js before signing in.");
        return;
    }

    try{
        if(!firebase.apps.length){
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        firebaseAuth = firebase.auth();
    }catch(error){
        console.error("Firebase initialization failed:",error);
        showLoginError("Firebase could not be initialized.");
    }
}

/* =========================================================
   STATE
========================================================= */

let customers = [];
let milk = [];
let payments = [];
let settings = {
    businessName:"Vijayalakshmi Milk Products",
    businessAddress:"",
    businessPhone:"",
    businessGstPercent:0,
    businessLogo:"",
    showFat:true,
    showSnf:true,
    showAdvance:true
};

/* Default business logo hosted in the public GitHub repository. */
const DEFAULT_LOGO_URL = "https://raw.githubusercontent.com/sanjeevanev-design/vijayalakshmi-milk/main/1.png";

/* =========================================================
   BASIC HELPERS
========================================================= */

function today(){
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,"0"),
        String(d.getDate()).padStart(2,"0")
    ].join("-");
}

function startOfMonth(){
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

function uid(prefix){
    if(window.crypto && crypto.randomUUID){
        return prefix + "_" + crypto.randomUUID();
    }

    return prefix + "_" + Date.now() + "_" +
        Math.random().toString(36).slice(2,10);
}

function money(value){
    const n = Number(value);

    return "₹" + (Number.isFinite(n) ? n : 0)
        .toLocaleString("en-IN",{
            minimumFractionDigits:2,
            maximumFractionDigits:2
        });
}

function formatDate(value){
    if(!value) return "-";

    const d = new Date(value + "T00:00:00");

    if(Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric"
    });
}

function escapeHTML(value){
    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

/* Escapes a value for safe use inside an HTML attribute (e.g. src="...").
   Same as escapeHTML but kept as a distinct name so attribute-context
   call sites are easy to audit. */
function escapeAttr(value){
    return escapeHTML(value);
}

function safeNumber(value,min=0,max=Number.MAX_SAFE_INTEGER){
    const n = Number(value);

    if(!Number.isFinite(n)) return null;

    if(n < min || n > max) return null;

    return n;
}

function entryAmount(record){
    const litres = safeNumber(record?.litres,0,999999999);
    const rate = safeNumber(record?.rate,0,999999999);

    if(litres === null || rate === null) return 0;

    return litres * rate;
}

function getCustomer(id){
    return customers.find(c => c.id === id);
}

function customerName(id){
    const c = getCustomer(id);
    return c ? String(c.name) : "Unknown Customer";
}

function initials(name){
    const text = String(name || "?").trim();

    if(!text) return "?";

    return text
        .split(/\s+/)
        .slice(0,2)
        .map(x => x[0])
        .join("")
        .toUpperCase();
}

function today(){
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,"0"),
        String(d.getDate()).padStart(2,"0")
    ].join("-");
}

function startOfMonth(){
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

function uid(prefix){
    if(window.crypto && crypto.randomUUID){
        return prefix + "_" + crypto.randomUUID();
    }

    return prefix + "_" + Date.now() + "_" +
        Math.random().toString(36).slice(2,10);
}

function money(value){
    const n = Number(value);

    return "₹" + (Number.isFinite(n) ? n : 0)
        .toLocaleString("en-IN",{
            minimumFractionDigits:2,
            maximumFractionDigits:2
        });
}

function formatDate(value){
    if(!value) return "-";

    const d = new Date(value + "T00:00:00");

    if(Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric"
    });
}

function escapeHTML(value){
    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

/* Escapes a value for safe use inside an HTML attribute (e.g. src="...").
   Same as escapeHTML but kept as a distinct name so attribute-context
   call sites are easy to audit. */
function escapeAttr(value){
    return escapeHTML(value);
}

function safeNumber(value,min=0,max=Number.MAX_SAFE_INTEGER){
    const n = Number(value);

    if(!Number.isFinite(n)) return null;

    if(n < min || n > max) return null;

    return n;
}

function entryAmount(record){
    const litres = safeNumber(record?.litres,0,999999999);
    const rate = safeNumber(record?.rate,0,999999999);

    if(litres === null || rate === null) return 0;

    return litres * rate;
}

function getCustomer(id){
    return customers.find(c => c.id === id);
}

function customerName(id){
    const c = getCustomer(id);
    return c ? String(c.name) : "Unknown Customer";
}

function initials(name){
    const text = String(name || "?").trim();

    if(!text) return "?";

    return text
        .split(/\s+/)
        .slice(0,2)
        .map(x => x[0])
        .join("")
        .toUpperCase();
}

function showToast(message,error=false){

    const toast = document.getElementById("toast");
    if(!toast) return;

    toast.textContent = message;
    toast.classList.toggle("error",error);
    toast.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(()=>{
        toast.classList.remove("show");
    },error ? 4000 : 2600);
}

/* =========================================================
   NAVIGATION
========================================================= */

function showPage(pageId){

    document.querySelectorAll(".page")
        .forEach(page=>page.classList.remove("active"));

    const page = document.getElementById(pageId);

    if(!page) return;

    page.classList.add("active");

    document.querySelectorAll(
        ".side-nav button,.bottom-nav button"
    ).forEach(button=>{

        button.classList.toggle(
            "active",
            button.dataset.page === pageId
        );

    });

    window.scrollTo({
        top:0,
        behavior:"smooth"
    });

    if(pageId === "paymentsPage"){
        renderPayments();
    }

    if(pageId === "statementPage"){
        populateStatementCustomer();
    }

    if(pageId === "settingsPage"){
        loadSettingsUI();
    }
}

/* =========================================================
   MODALS
========================================================= */

function openModal(id){
    document.getElementById(id)?.classList.add("show");
}

function closeModal(id){
    document.getElementById(id)?.classList.remove("show");
}

document.querySelectorAll(".modal").forEach(modal=>{

    modal.addEventListener("click",event=>{

        if(event.target === modal){
            modal.classList.remove("show");
        }

    });

});

document.addEventListener("keydown",event=>{

    if(event.key === "Escape"){

        document
            .querySelectorAll(".modal.show")
            .forEach(modal=>modal.classList.remove("show"));

    }

});

/* =========================================================
   CUSTOMER
========================================================= */

function openCustomerModal(id=null){

    const form = document.getElementById("customerForm");

    form.reset();

    document.getElementById("customerId").value = "";

    document.getElementById("customerModalTitle").textContent =
        id ? "Edit Customer" : "Add Customer";

    document.getElementById("customerPhoneError")
        .classList.add("hidden");

    const startDate = document.getElementById("customerStartDate");

    startDate.max = today();
    startDate.value = today();

    if(id){

        const customer = getCustomer(id);

        if(!customer){
            showToast("Customer not found.",true);
            return;
        }

        document.getElementById("customerId").value = customer.id;
        document.getElementById("customerName").value = customer.name || "";
        document.getElementById("customerPhone").value = customer.phone || "";
        document.getElementById("customerPlace").value = customer.place || "";

        startDate.value =
            customer.startDate && customer.startDate <= today()
                ? customer.startDate
                : today();
    }

    openModal("customerModal");
}

function saveCustomer(event){

    event.preventDefault();

    const id =
        document.getElementById("customerId").value.trim();

    const name =
        document.getElementById("customerName").value.trim();

    const phone =
        document.getElementById("customerPhone").value.trim();

    const place =
        document.getElementById("customerPlace").value.trim();

    const startDate =
        document.getElementById("customerStartDate").value || today();

    if(name.length < 2){
        showToast("Enter a valid customer name.",true);
        return;
    }

    if(phone && !/^\d{10}$/.test(phone)){

        document
            .getElementById("customerPhoneError")
            .classList.remove("hidden");

        showToast("Phone number must contain 10 digits.",true);

        return;
    }

    document
        .getElementById("customerPhoneError")
        .classList.add("hidden");

    if(startDate > today()){
        showToast("Starting date cannot be in the future.",true);
        return;
    }

    if(!isISODate(startDate)){
        showToast("Enter a valid starting date.",true);
        return;
    }

    const duplicate = customers.find(c=>
        c.id !== id &&
        phone &&
        c.phone === phone
    );

    if(duplicate){

        showToast(
            "A customer with this phone number already exists.",
            true
        );

        return;
    }

    if(id){

        const index = customers.findIndex(c=>c.id===id);

        if(index === -1){
            showToast("Customer not found.",true);
            return;
        }

        customers[index] = {
            ...customers[index],
            name:name.slice(0,80),
            phone,
            place:place.slice(0,80),
            startDate
        };

        showToast("Customer updated.");

    }else{

        /* FIX: guard against a corrupted/duplicate id collision when a
           record was tampered with directly in localStorage. uid() is
           already collision-safe via crypto.randomUUID, but this keeps
           saveCustomer() defensive even if that ever changes. */
        let newId = uid("customer");
        while(customers.some(c=>c.id===newId)){
            newId = uid("customer");
        }

        customers.push({
            id:newId,
            name:name.slice(0,80),
            phone,
            place:place.slice(0,80),
            startDate,
            createdAt:new Date().toISOString()
        });

        showToast("Customer added.");

    }

    updateAll();
    closeModal("customerModal");
}

function deleteCustomer(id){

    const customer = getCustomer(id);

    if(!customer) return;

    const milkCount =
        milk.filter(m=>m.customerId===id).length;

    const paymentCount =
        payments.filter(p=>p.customerId===id).length;

    const message =
        `Delete ${customer.name}?\n\n` +
        `Milk records: ${milkCount}\n` +
        `Payment records: ${paymentCount}\n\n` +
        `All related history will also be permanently deleted.`;

    if(!confirm(message)) return;

    customers =
        customers.filter(c=>c.id!==id);

    milk =
        milk.filter(m=>m.customerId!==id);

    payments =
        payments.filter(p=>p.customerId!==id);

    updateAll();
    showToast("Customer deleted.");
}

function renderCustomers(){

    const container =
        document.getElementById("customerGrid");

    const search =
        document
            .getElementById("customerSearch")
            ?.value
            .toLowerCase()
            .trim() || "";

    let list = [...customers];

    if(search){

        list = list.filter(c=>
            String(c.name || "").toLowerCase().includes(search) ||
            String(c.phone || "").includes(search) ||
            String(c.place || "").toLowerCase().includes(search)
        );

    }

    list.sort((a,b)=>
        String(a.name || "").localeCompare(
            String(b.name || "")
        )
    );

    if(!list.length){

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    <i class="bi bi-people"></i>
                </div>
                <strong>${search ? "No customers found" : "No customers yet"}</strong>
                <p>
                    ${search
                        ? "Try another search."
                        : "Add your first customer to start collecting milk."
                    }
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="customer-grid">
            ${list.map(c=>{

                const records =
                    milk.filter(m=>m.customerId===c.id);

                const litres =
                    records.reduce(
                        (sum,m)=>sum+Number(m.litres||0),
                        0
                    );

                const amount =
                    records.reduce(
                        (sum,m)=>sum+entryAmount(m),
                        0
                    );

                return `
                    <article class="customer-card">

                        <div class="customer-top">

                            <div class="customer-main">

                                <div class="avatar">
                                    ${escapeHTML(initials(c.name))}
                                </div>

                                <div class="customer-info">

                                    <strong>
                                        ${escapeHTML(c.name)}
                                    </strong>

                                    <span>
                                        <i class="bi bi-geo-alt"></i>
                                        ${escapeHTML(c.place || "Place not added")}
                                    </span>

                                </div>

                            </div>

                            <div class="actions">

                                <button
                                    class="icon-btn icon-whatsapp${
                                        /^\d{10}$/.test(c.phone || "")
                                            ? ""
                                            : " is-disabled"
                                    }"
                                    aria-label="Message on WhatsApp"
                                    title="Message on WhatsApp"
                                    onclick="sendCustomerWhatsApp('${escapeAttr(c.id)}')"
                                >
                                    <i class="bi bi-whatsapp"></i>
                                </button>

                                <button
                                    class="icon-btn icon-edit"
                                    aria-label="Edit customer"
                                    onclick="openCustomerModal('${escapeAttr(c.id)}')"
                                >
                                    <i class="bi bi-pencil"></i>
                                </button>

                                <button
                                    class="icon-btn icon-delete"
                                    aria-label="Delete customer"
                                    onclick="deleteCustomer('${escapeAttr(c.id)}')"
                                >
                                    <i class="bi bi-trash3"></i>
                                </button>

                            </div>

                        </div>

                        <div class="customer-meta">

                            <div class="meta">
                                <small>Phone</small>
                                <strong>
                                    ${escapeHTML(c.phone || "-")}
                                </strong>
                            </div>

                            <div class="meta">
                                <small>Total Milk</small>
                                <strong>
                                    ${litres.toFixed(2)} L
                                </strong>
                            </div>

                            <div class="meta">
                                <small>Collection Value</small>
                                <strong class="amount">
                                    ${money(amount)}
                                </strong>
                            </div>

                            <div class="meta">
                                <small>Started</small>
                                <strong>
                                    ${formatDate(c.startDate)}
                                </strong>
                            </div>

                        </div>

                    </article>
                `;

            }).join("")}
        </div>
    `;
}

/* =========================================================
   CUSTOMER SELECTS
========================================================= */

function populateCustomerSelects(){

    const selectIds = [
        "milkCustomer",
        "paymentCustomer",
        "statementCustomer"
    ];

    selectIds.forEach(id=>{

        const select =
            document.getElementById(id);

        if(!select) return;

        const current = select.value;

        const first =
            id === "statementCustomer"
                ? "Select customer"
                : "Select customer";

        select.innerHTML = `
            <option value="">${first}</option>

            ${customers
                .slice()
                .sort((a,b)=>
                    String(a.name).localeCompare(String(b.name))
                )
                .map(c=>`
                    <option value="${escapeAttr(c.id)}">
                        ${escapeHTML(c.name)}
                    </option>
                `)
                .join("")}
        `;

        if(customers.some(c=>c.id===current)){
            select.value = current;
        }

    });
}

/* =========================================================
   MILK
========================================================= */

function openMilkModal(id=null){

    if(!customers.length){

        showToast(
            "Add a customer before recording milk.",
            true
        );

        showPage("customersPage");

        return;
    }

    document
        .getElementById("milkForm")
        .reset();

    document.getElementById("milkId").value = "";

    document.getElementById("milkDate").max = today();
    document.getElementById("milkDate").value = today();

    document.getElementById("milkModalTitle").textContent =
        id ? "Edit Milk Collection" : "Add Morning Milk";

    populateCustomerSelects();

    document.getElementById("milkAmountPreview")
        .textContent = "₹0.00";

    if(id){

        const record =
            milk.find(m=>m.id===id);

        if(!record){

            showToast("Milk record not found.",true);

            return;
        }

        document.getElementById("milkId").value = record.id;
        document.getElementById("milkCustomer").value = record.customerId;
        document.getElementById("milkDate").value = record.date;
        document.getElementById("milkLitres").value = record.litres;
        document.getElementById("milkRate").value = record.rate;
        document.getElementById("milkFat").value =
            record.fat ?? "";
        document.getElementById("milkSnf").value =
            record.snf ?? "";

        updateMilkPreview();
    }

    openModal("milkModal");
}

function updateMilkPreview(){

    const litres =
        Number(document.getElementById("milkLitres").value || 0);

    const rate =
        Number(document.getElementById("milkRate").value || 0);

    const amount =
        litres > 0 && rate > 0
            ? Number((litres * rate).toFixed(2))
            : 0;

    document.getElementById("milkAmountPreview")
        .textContent = money(amount);
}

function saveMilkEntry(event){

    event.preventDefault();

    const id =
        document.getElementById("milkId").value.trim();

    const customerId =
        document.getElementById("milkCustomer").value;

    const date =
        document.getElementById("milkDate").value;

    const litres =
        safeNumber(
            document.getElementById("milkLitres").value,
            0.01,
            9999
        );

    const rate =
        safeNumber(
            document.getElementById("milkRate").value,
            0.01,
            100000
        );

    const fat =
        document.getElementById("milkFat").value === ""
            ? 0
            : safeNumber(
                document.getElementById("milkFat").value,
                0,
                15
            );

    const snf =
        document.getElementById("milkSnf").value === ""
            ? 0
            : safeNumber(
                document.getElementById("milkSnf").value,
                0,
                15
            );

    if(!getCustomer(customerId)){

        showToast("Please select a valid customer.",true);

        return;
    }

    if(!date || !isISODate(date)){

        showToast("Please select a valid collection date.",true);

        return;
    }

    if(date > today()){

        showToast(
            "Collection date cannot be in the future.",
            true
        );

        return;
    }

    if(litres === null){

        showToast(
            "Enter a valid milk quantity.",
            true
        );

        return;
    }

    if(rate === null){

        showToast(
            "Enter a valid rate per litre.",
            true
        );

        return;
    }

    if(fat === null || snf === null){

        showToast(
            "FAT and SNF must be between 0 and 15.",
            true
        );

        return;
    }

    /* Duplicate protection (kept as-is: one collection entry per
       customer per day, by design for a morning-only collection shop) */

    const duplicate =
        milk.find(m=>
            m.customerId === customerId &&
            m.date === date &&
            m.id !== id
        );

    if(duplicate){

        showToast(
            "Milk collection already exists for this customer on this date. Edit the existing entry instead.",
            true
        );

        return;
    }

    const amount =
        Number((litres * rate).toFixed(2));

    if(id){

        const index =
            milk.findIndex(m=>m.id===id);

        if(index === -1){

            showToast("Milk record not found.",true);

            return;
        }

        milk[index] = {
            ...milk[index],
            customerId,
            date,
            litres,
            fat,
            snf,
            rate,
            amount,
            updatedAt:new Date().toISOString()
        };

        showToast("Milk collection updated.");

    }else{

        milk.push({
            id:uid("milk"),
            customerId,
            date,
            litres,
            fat,
            snf,
            rate,
            amount,
            createdAt:new Date().toISOString()
        });

        showToast("Milk collection added.");

    }

    updateAll();
    closeModal("milkModal");
}

function deleteMilk(id){

    const record =
        milk.find(m=>m.id===id);

    if(!record) return;

    if(!confirm("Delete this milk collection entry?")){
        return;
    }

    milk =
        milk.filter(m=>m.id!==id);

    updateAll();
    showToast("Milk entry deleted.");
}


/* =========================================================
   MILK COLLECTION DATE HELPERS
   - Stored milk records are NEVER changed here.
   - These helpers only calculate which calendar dates to display.
========================================================= */

function localISODate(date){

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2,"0");
    const d = String(date.getDate()).padStart(2,"0");

    return `${y}-${m}-${d}`;
}

function addDaysToISO(dateString, amount){

    const parts = String(dateString).split("-").map(Number);

    if(parts.length !== 3 || parts.some(n=>!Number.isFinite(n))){
        return dateString;
    }

    const date = new Date(parts[0], parts[1]-1, parts[2]);
    date.setDate(date.getDate() + amount);

    return localISODate(date);
}

function shortMilkDate(dateString){

    const parts = String(dateString).split("-").map(Number);

    if(parts.length !== 3 || parts.some(n=>!Number.isFinite(n))){
        return dateString;
    }

    const date = new Date(parts[0], parts[1]-1, parts[2]);

    return date.toLocaleDateString("en-IN",{
        day:"numeric",
        month:"short"
    });
}

function getCurrentMilkPeriod(){

    const current = new Date();
    const day = current.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const startDate = new Date(current);
    startDate.setDate(current.getDate() + mondayOffset);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const dates = Array.from({length:7},(_,i)=>{
        const d = new Date(startDate);
        d.setDate(startDate.getDate()+i);
        return localISODate(d);
    });

    return {
        start: localISODate(startDate),
        end: localISODate(endDate),
        label: `${startDate.toLocaleDateString("en-IN",{day:"numeric",month:"short"})} – ${endDate.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}`,
        dates
    };
}

function renderTodayMilkTable(records, search){

    const todayDate = today();

    const query = String(search || "").toLowerCase().trim();
    const list = records
        .filter(m=>m.date===todayDate)
        .filter(m=>{
            if(!query) return true;
            const customer = getCustomer(m.customerId);
            return [customer?.name, customer?.phone, customer?.place]
                .some(value=>String(value || "").toLowerCase().includes(query));
        })
        .sort((a,b)=>String(a.id).localeCompare(String(b.id)));

    const totalLitres = list.reduce(
        (sum,m)=>sum+Number(m.litres||0),0
    );

    const totalAmount = list.reduce(
        (sum,m)=>sum+entryAmount(m),0
    );

    if(!list.length){

        return `
            <section class="milk-table-section">
                <div class="milk-section-header">
                    <div class="milk-section-title">
                        <div class="milk-section-icon"><i class="bi bi-cup-straw"></i></div>
                        <div class="milk-section-copy">
                            <h2>Today</h2>
                            <p>${formatDate(todayDate)} · Daily collection records</p>
                        </div>
                    </div>
                    <div class="milk-section-meta">
                        <span class="milk-period-badge"><i class="bi bi-calendar-check"></i> Today</span>
                    </div>
                </div>

                <div class="empty">
                    <div class="empty-icon">
                        <i class="bi bi-droplet"></i>
                    </div>
                    <strong>No milk collection for today</strong>
                    <p>${search ? "No matching customer was found today." : "Add today's milk collection to get started."}</p>
                </div>
            </section>
        `;
    }

    return `
        <section class="milk-table-section">

            <div class="milk-section-header">
                <div class="milk-section-title">
                    <div class="milk-section-icon"><i class="bi bi-cup-straw"></i></div>
                    <div class="milk-section-copy">
                        <h2>Today</h2>
                        <p>${formatDate(todayDate)} · Daily collection records</p>
                    </div>
                </div>
                <div class="milk-section-meta">
                    <span class="milk-summary-pill"><i class="bi bi-droplet-half"></i>${totalLitres.toFixed(2)} L</span>
                    <span class="milk-period-badge"><i class="bi bi-calendar-check"></i> Today</span>
                </div>
            </div>

            <div class="table-wrap">
                <table class="data-table today-milk-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Litres</th>
                            <th>FAT</th>
                            <th>SNF</th>
                            <th>Rate/L</th>
                            <th>Amount</th>
                            <th>Message</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${list.map(m=>{

                            const customer = getCustomer(m.customerId);
                            const hasValidPhone = /^\d{10}$/.test(customer?.phone || "");

                            return `
                                <tr>
                                    <td>${formatDate(m.date)}</td>
                                    <td><strong>${escapeHTML(customerName(m.customerId))}</strong></td>
                                    <td>${Number(m.litres||0).toFixed(2)} L</td>
                                    <td>${Number(m.fat||0).toFixed(2)}%</td>
                                    <td>${Number(m.snf||0).toFixed(2)}%</td>
                                    <td>${money(m.rate)}</td>
                                    <td class="amount">${money(entryAmount(m))}</td>
                                    <td>
                                        <button
                                            class="btn-whatsapp${hasValidPhone ? "" : " is-disabled"}"
                                            aria-label="Send WhatsApp message"
                                            title="${hasValidPhone ? "Send collection details on WhatsApp" : "Add a valid 10-digit phone number to enable WhatsApp"}"
                                            onclick="sendMilkWhatsApp('${escapeAttr(m.id)}')"
                                        >
                                            <i class="bi bi-whatsapp"></i>
                                            Send
                                        </button>
                                    </td>
                                    <td>
                                        <div class="actions">
                                            <button class="icon-btn icon-edit" onclick="openMilkModal('${escapeAttr(m.id)}')" aria-label="Edit">
                                                <i class="bi bi-pencil"></i>
                                            </button>
                                            <button class="icon-btn icon-delete" onclick="deleteMilk('${escapeAttr(m.id)}')" aria-label="Delete">
                                                <i class="bi bi-trash3"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>

                    <tfoot>
                        <tr class="total-row">
                            <td colspan="2">Total</td>
                            <td>${totalLitres.toFixed(2)} L</td>
                            <td>—</td>
                            <td>—</td>
                            <td>—</td>
                            <td>${money(totalAmount)}</td>
                            <td>—</td>
                            <td>—</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    `;
}

function renderMilkAmountPeriodTable(records, search){

    const period = getCurrentMilkPeriod();
    const dates = period.dates;

    let customerList = [...customers];

    if(search){
        customerList = customerList.filter(c=>
            [c.name, c.phone, c.place]
                .some(value=>String(value || "").toLowerCase().includes(search))
        );
    }

    /* Include customers who have milk records in the active period even if
       a customer record was later removed. This does not alter stored data. */
    const activeCustomerIds = new Set(
        records
            .filter(m=>m.date>=period.start && m.date<=period.end)
            .map(m=>m.customerId)
    );

    activeCustomerIds.forEach(customerId=>{
        const customer = getCustomer(customerId);
        if(customer && !customerList.some(c=>c.id===customerId)){
            if(!search || customerName(customerId).toLowerCase().includes(search)){
                customerList.push(customer);
            }
        }
    });

    customerList.sort((a,b)=>
        String(a.name||"").localeCompare(String(b.name||""))
    );

    const recordMap = new Map();

    records.forEach(m=>{
        if(m.date>=period.start && m.date<=period.end){
            recordMap.set(`${m.customerId}|${m.date}`,m);
        }
    });

    const rows = customerList.map((customer,index)=>{

        let total = 0;

        const cells = dates.map(date=>{
            const entry = recordMap.get(`${customer.id}|${date}`);
            const amount = entry ? entryAmount(entry) : 0;

            total += amount;

            return `<td class="period-amount-cell">${entry ? money(amount) : "—"}</td>`;
        }).join("");

        return `
            <tr>
                <td>${index+1}</td>
                <td><strong>${escapeHTML(customer.name || "Unknown Customer")}</strong></td>
                ${cells}
                <td class="amount period-total">${money(total)}</td>
            </tr>
        `;
    }).join("");

    const hasRows = customerList.length > 0;

    return `
        <section class="milk-table-section milk-period-section">
            <div class="milk-section-header">
                <div class="milk-section-title">
                    <div class="milk-section-icon"><i class="bi bi-calendar3-week"></i></div>
                    <div class="milk-section-copy">
                        <h2>Week End</h2>
                        
                    </div>
                </div>
                <div class="milk-section-meta">
                    
                </div>
            </div>
            ${hasRows ? `
                <div class="table-wrap">
                    <table class="data-table period-amount-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Customer</th>
                                ${dates.map(date=>`<th class="date-column"><span>${escapeHTML(shortMilkDate(date))}</span></th>`).join("")}
                                <th>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            ` : `
                <div class="empty">
                    <div class="empty-icon"><i class="bi bi-calendar3"></i></div>
                    <strong>No customers found</strong>
                    <p>${search ? "Try another customer search." : "Customers will appear here when they are added."}</p>
                </div>
            `}
        </section>
    `;
}

function renderMilk(){

    const container = document.getElementById("milkTable");
    if(!container) return;

    const search = document
        .getElementById("milkSearch")
        ?.value
        .toLowerCase()
        .trim() || "";

    /* IMPORTANT:
       Do not filter, rewrite, delete, or mutate the stored milk array.
       The two tables are display-only views over the same historical data. */
    const records = [...milk];

    container.innerHTML =
        renderTodayMilkTable(records,search) +
        renderMilkAmountPeriodTable(records,search);

    if(typeof updateMilkDateWatcher === "function"){
        updateMilkDateWatcher();
    }
}

let milkDisplayDate = today();
let milkDateWatcherStarted = false;

function updateMilkDateWatcher(){
    if(milkDateWatcherStarted) return;

    milkDateWatcherStarted = true;

    setInterval(()=>{
        const current = today();

        if(current !== milkDisplayDate){
            milkDisplayDate = current;
            renderMilk();
        }
    },60000);
}

/* =========================================================
   PAYMENTS
========================================================= */

function openPaymentModal(type="Advance",id=null){

    if(!customers.length){

        showToast(
            "Add a customer before recording a payment.",
            true
        );

        showPage("customersPage");

        return;
    }

    document.getElementById("paymentForm").reset();

    document.getElementById("paymentId").value = "";

    document.getElementById("paymentDate").max = today();
    document.getElementById("paymentDate").value = today();

    document.getElementById("paymentType").value =
        type === "Payment" ? "Payment" : "Advance";

    document.getElementById("paymentModalTitle").textContent =
        id ? "Edit Payment" :
        type === "Advance"
            ? "Give Advance"
            : "Add Payment";

    populateCustomerSelects();

    if(id){

        const record =
            payments.find(p=>p.id===id);

        if(!record){

            showToast("Payment record not found.",true);

            return;
        }

        document.getElementById("paymentId").value = record.id;
        document.getElementById("paymentCustomer").value = record.customerId;
        document.getElementById("paymentType").value =
            record.type === "Payment"
                ? "Payment"
                : "Advance";

        document.getElementById("paymentDate").value = record.date;
        document.getElementById("paymentAmount").value = record.amount;
        document.getElementById("paymentMethod").value =
            record.method || "Cash";

        document.getElementById("paymentNote").value =
            record.note || "";
    }

    openModal("paymentModal");
}

function savePayment(event){

    event.preventDefault();

    const id =
        document.getElementById("paymentId").value.trim();

    const customerId =
        document.getElementById("paymentCustomer").value;

    const type =
        document.getElementById("paymentType").value;

    const date =
        document.getElementById("paymentDate").value;

    const amount =
        safeNumber(
            document.getElementById("paymentAmount").value,
            0.01,
            100000000
        );

    const method =
        document.getElementById("paymentMethod").value;

    const note =
        document.getElementById("paymentNote").value.trim();

    if(!getCustomer(customerId)){

        showToast("Please select a valid customer.",true);

        return;
    }

    if(type !== "Advance" && type !== "Payment"){

        showToast("Invalid payment type.",true);

        return;
    }

    if(!date || !isISODate(date)){

        showToast("Please select a valid payment date.",true);

        return;
    }

    if(date > today()){

        showToast(
            "Payment date cannot be in the future.",
            true
        );

        return;
    }

    if(amount === null){

        showToast("Enter a valid payment amount.",true);

        return;
    }

    const cleanNote =
        note.slice(0,250);

    /* FIX (bug #14): guard against accidental duplicate payment entries —
       e.g. a double-tap on "Save" or the form being submitted twice.
       If an identical payment (same customer, date, type, amount, method)
       already exists, ask the user to confirm before adding another one
       instead of silently doubling the financial total. Editing an
       existing record (id set) is unaffected. */
    if(!id){

        const possibleDuplicate = payments.find(p=>
            p.customerId === customerId &&
            p.date === date &&
            p.type === type &&
            Number(p.amount) === Number(amount) &&
            String(p.method || "Cash") === String(method)
        );

        if(possibleDuplicate){

            const proceed = confirm(
                `A similar ${type.toLowerCase()} of ${money(amount)} for this customer ` +
                `on ${formatDate(date)} was already recorded.\n\n` +
                `Add this as a separate entry anyway?`
            );

            if(!proceed){
                return;
            }

        }

    }

    if(id){

        const index =
            payments.findIndex(p=>p.id===id);

        if(index === -1){

            showToast("Payment record not found.",true);

            return;
        }

        payments[index] = {
            ...payments[index],
            customerId,
            type,
            date,
            amount,
            method,
            note:cleanNote,
            updatedAt:new Date().toISOString()
        };

        showToast("Payment updated.");

    }else{

        payments.push({
            id:uid("payment"),
            customerId,
            type,
            date,
            amount,
            method,
            note:cleanNote,
            createdAt:new Date().toISOString()
        });

        showToast(
            type === "Advance"
                ? "Advance recorded."
                : "Payment recorded."
        );

    }

    updateAll();
    closeModal("paymentModal");
}

function deletePayment(id){

    if(!payments.some(p=>p.id===id)){
        return;
    }

    if(!confirm("Delete this payment record?")){
        return;
    }

    payments =
        payments.filter(p=>p.id!==id);

    updateAll();
    showToast("Payment deleted.");
}

function renderPayments(){

    renderAdvance();
    renderBalance();
    renderPaymentHistory();

}

function renderAdvance(){

    const container =
        document.getElementById("advanceTable");

    const advances =
        payments
            .filter(p=>p.type==="Advance")
            .sort((a,b)=>
                String(b.date).localeCompare(String(a.date))
            );

    const total =
        advances.reduce(
            (sum,p)=>sum+Number(p.amount||0),
            0
        );

    const unique =
        new Set(
            advances.map(p=>p.customerId)
        ).size;

    document.getElementById("totalAdvance")
        .textContent = money(total);

    document.getElementById("advanceCustomers")
        .textContent = unique;

    if(!advances.length){

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    <i class="bi bi-wallet2"></i>
                </div>
                <strong>No advance payments</strong>
                <p>Advance records will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="table-wrap">

            <table class="data-table">

                <thead>
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Note</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>

                    ${advances.map((p,index)=>`

                        <tr>

                            <td>${index+1}</td>

                            <td>${formatDate(p.date)}</td>

                            <td>
                                <strong>
                                    ${escapeHTML(customerName(p.customerId))}
                                </strong>
                            </td>

                            <td class="amount">
                                ${money(p.amount)}
                            </td>

                            <td>${escapeHTML(p.method || "-")}</td>

                            <td>${escapeHTML(p.note || "-")}</td>

                            <td>

                                <div class="actions">

                                    <button
                                        class="icon-btn icon-edit"
                                        onclick="openPaymentModal('Advance','${escapeAttr(p.id)}')"
                                    >
                                        <i class="bi bi-pencil"></i>
                                    </button>

                                    <button
                                        class="icon-btn icon-delete"
                                        onclick="deletePayment('${escapeAttr(p.id)}')"
                                    >
                                        <i class="bi bi-trash3"></i>
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `).join("")}

                </tbody>

                <tfoot>

                    <tr class="total-row">
                        <td colspan="3">Total Advance</td>
                        <td>${money(total)}</td>
                        <td colspan="3">—</td>
                    </tr>

                </tfoot>

            </table>

        </div>
    `;
}

function getCustomerFinancials(customerId){

    const customerMilk =
        milk.filter(m=>m.customerId===customerId);

    const customerPayments =
        payments.filter(p=>p.customerId===customerId);

    const milkAmount =
        customerMilk.reduce(
            (sum,m)=>sum+entryAmount(m),
            0
        );

    const paidAmount =
        customerPayments.reduce(
            (sum,p)=>sum+(safeNumber(p.amount,0,100000000) || 0),
            0
        );

    const advanceAmount =
        customerPayments
            .filter(p=>p.type==="Advance")
            .reduce(
                (sum,p)=>sum+(safeNumber(p.amount,0,100000000) || 0),
                0
            );

    const balance =
        milkAmount-paidAmount;

    return {
        milkAmount,
        paidAmount,
        advanceAmount,
        balance,
        milkCount:customerMilk.length,
        paymentCount:customerPayments.length,
        isOverpaid:balance < 0
    };
}

/* =========================================================
   WHATSAPP INTEGRATION
   Uses WhatsApp's public click-to-chat link (wa.me) — no API key,
   no server, no cost. It only opens a pre-filled chat; the message
   is still sent manually by whoever clicks Send in WhatsApp.
========================================================= */

function normalizeWhatsAppNumber(phone){

    const digits =
        String(phone || "").replace(/\D/g,"");

    if(digits.length === 10) return "91" + digits;

    if(digits.length === 12 && digits.startsWith("91")) return digits;

    return null;
}

function openWhatsAppChat(phone,message){
    const number = normalizeWhatsAppNumber(phone);
    if(!number){
        showToast("Add a valid 10-digit phone number for this customer to use WhatsApp.", true);
        return;
    }
    /* SECURITY: number is digits-only (validated above) and message is
       percent-encoded, so this cannot be used to break out of the wa.me
       URL or inject a different scheme. */
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(url,"_blank","noopener,noreferrer");
}

function sendMilkWhatsApp(milkId){
    const record = milk.find(m=>m.id===milkId);
    if(!record) return;
    const customer = getCustomer(record.customerId);
    if(!customer) return;
    const businessName = settings.businessName || "Vijayalakshmi Milk Products";
    const message =
    `🥛 ${businessName}\n\n` +
    `Hello ${customer.name} 👋\n\n` +
    `Your milk collection details:\n\n` +
    `📅 Date: ${formatDate(record.date)}\n` +
    `🥛 Milk: ${Number(record.litres || 0).toFixed(2)} Litre\n` +
    `🧪 FAT: ${Number(record.fat || 0).toFixed(2)}%\n` +
    `🧪 SNF: ${Number(record.snf || 0).toFixed(2)}%\n` +
    `💰 Rate: ${money(record.rate)}/L\n` +
    `💵 Total: ${money(entryAmount(record))}\n\n` +
    `Thank you! 🙏`;

openWhatsAppChat(customer.phone, message);
}

function sendCustomerWhatsApp(customerId){

    const customer =
        getCustomer(customerId);

    if(!customer) return;

    const f =
        getCustomerFinancials(customerId);

    const businessName =
        settings.businessName || "Vijayalakshmi Milk Products";

    const balanceLine =
        f.isOverpaid
            ? `Advance balance carried: ${money(Math.abs(f.balance))}.`
            : `Balance due: ${money(f.balance)}.`;

    const message =
        `Hello ${customer.name}, this is ${businessName}.\n` +
        `Total milk collected: ${f.milkCount} entries worth ${money(f.milkAmount)}.\n` +
        `${balanceLine}\nThank you for your business!`;

    openWhatsAppChat(customer.phone,message);
}

function renderBalance(){

    const container =
        document.getElementById("balanceTable");

    if(!customers.length){

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    <i class="bi bi-people"></i>
                </div>
                <strong>No customers</strong>
                <p>Add customers to see balances.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="table-wrap">

            <table class="data-table">

                <thead>

                    <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Milk Value</th>
                        <th>Total Paid</th>
                        <th>Advance</th>
                        <th>Balance</th>
                        <th>Last Payment</th>
                    </tr>

                </thead>

                <tbody>

                    ${customers.map((c,index)=>{

                        const f =
                            getCustomerFinancials(c.id);

                        const last =
                            payments
                                .filter(p=>p.customerId===c.id)
                                .sort((a,b)=>
                                    String(b.date).localeCompare(
                                        String(a.date)
                                    )
                                )[0];

                        let balanceText;

                        if(f.balance < 0){

                            balanceText =
                                `Advance ${money(Math.abs(f.balance))}`;

                        }else if(f.balance > 0){

                            balanceText =
                                `To Pay ${money(f.balance)}`;

                        }else{

                            balanceText = "Settled";

                        }

                        return `

                            <tr>

                                <td>${index+1}</td>

                                <td>
                                    <strong>
                                        ${escapeHTML(c.name)}
                                    </strong>
                                </td>

                                <td>${money(f.milkAmount)}</td>

                                <td>${money(f.paidAmount)}</td>

                                <td>${money(f.advanceAmount)}</td>

                                <td class="amount">
                                    ${escapeHTML(balanceText)}
                                </td>

                                <td>
                                    ${last
                                        ? formatDate(last.date)
                                        : "-"
                                    }
                                </td>

                            </tr>

                        `;

                    }).join("")}

                </tbody>

            </table>

        </div>
    `;
}

function renderPaymentHistory(){

    const container =
        document.getElementById("paymentHistoryTable");

    const list =
        [...payments].sort((a,b)=>
            String(b.date).localeCompare(String(a.date))
        );

    if(!list.length){

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    <i class="bi bi-clock-history"></i>
                </div>
                <strong>No payment history</strong>
                <p>Add an advance or payment record.</p>
            </div>
        `;

        return;
    }

    /* FIX (bug #16): a single mixed "Total" for Advance + Payment together
       was misleading. Now the footer shows Advance, Payment and Grand
       Total separately so it's clear at a glance how much was given as
       advance vs. settled as payment. */
    const totalAdvance =
        list.filter(p=>p.type==="Advance")
            .reduce((sum,p)=>sum+Number(p.amount||0),0);

    const totalPayment =
        list.filter(p=>p.type==="Payment")
            .reduce((sum,p)=>sum+Number(p.amount||0),0);

    const grandTotal = totalAdvance + totalPayment;

    container.innerHTML = `
        <div class="table-wrap">

            <table class="data-table">

                <thead>
                    <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Note</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>

                    ${list.map((p,index)=>`

                        <tr>

                            <td>${index+1}</td>

                            <td>${formatDate(p.date)}</td>

                            <td>
                                <strong>
                                    ${escapeHTML(customerName(p.customerId))}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(p.type)}
                            </td>

                            <td class="amount">
                                ${money(p.amount)}
                            </td>

                            <td>
                                ${escapeHTML(p.method || "-")}
                            </td>

                            <td>
                                ${escapeHTML(p.note || "-")}
                            </td>

                            <td>

                                <div class="actions">

                                    <button
                                        class="icon-btn icon-edit"
                                        onclick="openPaymentModal('${escapeAttr(p.type)}','${escapeAttr(p.id)}')"
                                    >
                                        <i class="bi bi-pencil"></i>
                                    </button>

                                    <button
                                        class="icon-btn icon-delete"
                                        onclick="deletePayment('${escapeAttr(p.id)}')"
                                    >
                                        <i class="bi bi-trash3"></i>
                                    </button>

                                </div>

                            </td>

                        </tr>

                    `).join("")}

                </tbody>

                <tfoot>

                    <tr class="total-row">
                        <td colspan="4">Total Advance</td>
                        <td>${money(totalAdvance)}</td>
                        <td colspan="3">—</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="4">Total Payment</td>
                        <td>${money(totalPayment)}</td>
                        <td colspan="3">—</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="4">Grand Total</td>
                        <td>${money(grandTotal)}</td>
                        <td colspan="3">—</td>
                    </tr>

                </tfoot>

            </table>

        </div>
    `;
}

function switchPaymentTab(tabId,button){

    document
        .querySelectorAll("#paymentsPage .panel")
        .forEach(panel=>panel.classList.remove("active"));

    document
        .querySelectorAll("#paymentsPage .tab")
        .forEach(tab=>tab.classList.remove("active"));

    document
        .getElementById(tabId)
        ?.classList.add("active");

    button?.classList.add("active");
}

/* =========================================================
   AUTOMATIC DASHBOARD BANNER
========================================================= */

function getDashboardGreeting(date = new Date()){

    const hour = date.getHours();

    if(hour >= 5 && hour < 12){
        return "Good Morning 👋";
    }

    if(hour >= 12 && hour < 17){
        return "Good Afternoon 👋";
    }

    if(hour >= 17 && hour < 21){
        return "Good Evening 👋";
    }

    return "Good Night 👋";
}

function updateDashboardBanner(){

    const now = new Date();

    const greeting =
        document.getElementById("dashboardGreeting");

    const date =
        document.getElementById("dashboardDate");

    if(greeting){
        greeting.textContent = getDashboardGreeting(now);
    }

    if(date){
        date.textContent =
            now.toLocaleDateString("en-IN",{
                weekday:"long",
                day:"numeric",
                month:"long",
                year:"numeric"
            });
    }
}

/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard(){

    const currentDate = today();

    const todayMilk =
        milk.filter(m=>m.date===currentDate);

    const customersToday =
        new Set(
            todayMilk.map(m=>m.customerId)
        ).size;

    const totalMilk =
        todayMilk.reduce(
            (sum,m)=>sum+(safeNumber(m.litres,0,999999999) || 0),
            0
        );

    const totalAmount =
        todayMilk.reduce(
            (sum,m)=>sum+entryAmount(m),
            0
        );

    const todayAdvance =
        payments
            .filter(p=>
                p.date===currentDate &&
                p.type==="Advance"
            )
            .reduce(
                (sum,p)=>sum+Number(p.amount||0),
                0
            );

    document.getElementById("statCustomers")
        .textContent = customersToday;

    document.getElementById("statMilk")
        .textContent =
            totalMilk.toFixed(2) + " L";

    document.getElementById("statCollection")
        .textContent =
            money(totalAmount);

    document.getElementById("statAdvance")
        .textContent =
            money(todayAdvance);

    updateDashboardBanner();

    renderDashboardCollection();
}

function renderDashboardCollection(){

    const container =
        document.getElementById("dashboardCollection");

    const list =
        milk
            .filter(m=>m.date===today())
            .sort((a,b)=>
                customerName(a.customerId)
                    .localeCompare(
                        customerName(b.customerId)
                    )
            );

    if(!list.length){

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    <i class="bi bi-droplet"></i>
                </div>
                <strong>No collection recorded today</strong>
                <p>Add today's milk entries to see them here.</p>
            </div>
        `;

        return;
    }

    const totalLitres =
        list.reduce(
            (sum,m)=>sum+Number(m.litres||0),
            0
        );

    const totalAmount =
        list.reduce(
            (sum,m)=>sum+entryAmount(m),
            0
        );

    container.innerHTML = `
        <div class="table-wrap">

            <table class="data-table">

                <thead>
                    <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Litres</th>
                        <th>Rate</th>
                        <th>Amount</th>
                    </tr>
                </thead>

                <tbody>

                    ${list.map((m,index)=>`

                        <tr>
                            <td>${index+1}</td>

                            <td>
                                ${escapeHTML(
                                    customerName(m.customerId)
                                )}
                            </td>

                            <td>
                                ${Number(m.litres||0).toFixed(2)} L
                            </td>

                            <td>
                                ${money(m.rate)}
                            </td>

                            <td class="amount">
                                ${money(entryAmount(m))}
                            </td>
                        </tr>

                    `).join("")}

                </tbody>

                <tfoot>

                    <tr class="total-row">
                        <td colspan="2">Total</td>
                        <td>${totalLitres.toFixed(2)} L</td>
                        <td>—</td>
                        <td>${money(totalAmount)}</td>
                    </tr>

                </tfoot>

            </table>

        </div>
    `;
}

/* =========================================================
   STATEMENT
========================================================= */

function populateStatementCustomer(){

    populateCustomerSelects();

    const start =
        document.getElementById("statementStart");

    const end =
        document.getElementById("statementEnd");

    start.max = today();
    end.max = today();

    if(!start.value){
        start.value = startOfMonth();
    }

    if(!end.value){
        end.value = today();
    }

    generateStatementPreview();
}

function getStatementData(){

    const customerId =
        document.getElementById("statementCustomer").value;

    const start =
        document.getElementById("statementStart").value;

    const end =
        document.getElementById("statementEnd").value;

    const error =
        document.getElementById("statementDateError");

    if(start && end && start > end){

        error.classList.remove("hidden");

        return null;
    }

    error.classList.add("hidden");

    if(!customerId) return null;

    const customer =
        getCustomer(customerId);

    if(!customer) return null;

    const rows =
        milk
            .filter(m=>
                m.customerId===customerId &&
                (!start || m.date>=start) &&
                (!end || m.date<=end)
            )
            .sort((a,b)=>
                String(a.date).localeCompare(
                    String(b.date)
                )
            );

    const statementPayments =
        payments
            .filter(p=>
                p.customerId===customerId &&
                (!start || p.date>=start) &&
                (!end || p.date<=end)
            )
            .sort((a,b)=>
                String(a.date).localeCompare(
                    String(b.date)
                )
            );

    const totalLitres =
        rows.reduce(
            (sum,m)=>sum+Number(m.litres||0),
            0
        );

    const totalAmount =
        rows.reduce(
            (sum,m)=>sum+entryAmount(m),
            0
        );

    const totalPaid =
        statementPayments.reduce(
            (sum,p)=>sum+Number(p.amount||0),
            0
        );

    const advance =
        statementPayments
            .filter(p=>p.type==="Advance")
            .reduce(
                (sum,p)=>sum+Number(p.amount||0),
                0
            );

    const balance =
        totalAmount-totalPaid;

    return {
        customer,
        rows,
        statementPayments,
        totalLitres,
        totalAmount,
        totalPaid,
        advance,
        balance,
        isOverpaid:balance<0,
        start,
        end
    };
}

function generateStatementPreview(){

    const container =
        document.getElementById("statementPreview");

    const data =
        getStatementData();

    if(!data){

        const invalid =
            !document
                .getElementById("statementDateError")
                .classList
                .contains("hidden");

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">
                    <i class="bi bi-file-earmark-text"></i>
                </div>

                <strong>Statement Preview</strong>

                <p>
                    ${invalid
                        ? "Fix the date range."
                        : "Select a customer to generate the statement."
                    }
                </p>
            </div>
        `;

        return;
    }

    const {
        customer,
        rows,
        totalLitres,
        totalAmount,
        start,
        end
    } = data;

    const LOGO_URL = settings.businessLogo || DEFAULT_LOGO_URL;

    container.innerHTML = `

        <div class="a4">

            <img
                class="a4-watermark"
                src="${escapeAttr(LOGO_URL)}"
                alt=""
                aria-hidden="true"
                crossorigin="anonymous"
            >

            <div class="a4-head">

                <div class="a4-brand">

                    <div class="a4-logo">
                        <img
                            src="${escapeAttr(LOGO_URL)}"
                            alt="Vijayalakshmi Milk Products logo"
                            crossorigin="anonymous"
                        >
                    </div>

                    <div>

                        <div class="a4-business">
                            ${escapeHTML(settings.businessName)}
                        </div>

                        <div class="a4-sub">
                            ${escapeHTML(
                                settings.businessAddress ||
                                "Milk Collection & Products"
                            )}

                            ${settings.businessPhone
                                ? " · " +
                                  escapeHTML(settings.businessPhone)
                                : ""
                            }

                            ${settings.businessGstPercent > 0
                                ? " · GST: " +
                                  Number(settings.businessGstPercent).toFixed(2) + "%"
                                : ""
                            }
                        </div>

                    </div>

                </div>

                <div class="a4-title">

                    <strong>MILK COLLECTION STATEMENT</strong>

                    <span>
                        Generated ${formatDate(today())}
                    </span>

                </div>

            </div>

            <div class="a4-customer">

                <div class="a4-detail">
                    <small>Customer</small>
                    <strong>
                        ${escapeHTML(customer.name)}
                    </strong>
                </div>

                <div class="a4-detail">
                    <small>Phone</small>
                    <strong>
                        ${escapeHTML(customer.phone || "-")}
                    </strong>
                </div>

                <div class="a4-detail">
                    <small>Place</small>
                    <strong>
                        ${escapeHTML(customer.place || "-")}
                    </strong>
                </div>

                <div class="a4-detail">
                    <small>Collection Period</small>
                    <strong>
                        ${formatDate(start)} - ${formatDate(end)}
                    </strong>
                </div>

            </div>

            <table class="a4-table">

                <thead>

                    <tr>

                        <th>Date</th>
                        <th>Litres</th>

                        ${settings.showFat
                            ? "<th>FAT %</th>"
                            : ""
                        }

                        ${settings.showSnf
                            ? "<th>SNF %</th>"
                            : ""
                        }

                        <th>Rate/L</th>
                        <th>Amount</th>

                    </tr>

                </thead>

                <tbody>

                    ${rows.length

                        ? rows.map(m=>`

                            <tr>

                                <td>${formatDate(m.date)}</td>

                                <td>
                                    ${Number(m.litres||0).toFixed(2)}
                                </td>

                                ${settings.showFat
                                    ? `<td>${Number(m.fat||0).toFixed(2)}</td>`
                                    : ""
                                }

                                ${settings.showSnf
                                    ? `<td>${Number(m.snf||0).toFixed(2)}</td>`
                                    : ""
                                }

                                <td>${money(m.rate)}</td>

                                <td>${money(entryAmount(m))}</td>

                            </tr>

                        `).join("")

                        : `
                            <tr>
                                <td
                                    colspan="${
                                        4 +
                                        (settings.showFat ? 1 : 0) +
                                        (settings.showSnf ? 1 : 0)
                                    }"
                                    style="text-align:center;padding:25px"
                                >
                                    No milk records for this period.
                                </td>
                            </tr>
                        `
                    }

                </tbody>

                <tfoot>

                    <tr class="a4-total">

                        <td>Total</td>

                        <td>
                            ${totalLitres.toFixed(2)} L
                        </td>

                        ${settings.showFat ? "<td>—</td>" : ""}
                        ${settings.showSnf ? "<td>—</td>" : ""}

                        <td>—</td>

                        <td>${money(totalAmount)}</td>

                    </tr>

                    ${settings.businessGstPercent > 0 ? `
                        <tr class="a4-total">
                            <td colspan="${3 + (settings.showFat?1:0) + (settings.showSnf?1:0)}">
                                GST (${Number(settings.businessGstPercent).toFixed(2)}%)
                            </td>
                            <td>${money(totalAmount * settings.businessGstPercent / 100)}</td>
                        </tr>
                        <tr class="a4-total">
                            <td colspan="${3 + (settings.showFat?1:0) + (settings.showSnf?1:0)}">
                                Grand Total
                            </td>
                            <td>${money(totalAmount * (1 + settings.businessGstPercent / 100))}</td>
                        </tr>
                    ` : ""}

                </tfoot>

            </table>

            ${renderStatementSummary(data)}

            <div class="signature">
                Authorized Signature
            </div>

        </div>
    `;
}

function renderStatementSummary(data){

    const {
        totalLitres,
        totalAmount,
        totalPaid,
        statementPayments
    } = data;

    const gstPercent = safeNumber(settings.businessGstPercent,0,100) || 0;
    const gstAmount = Number((totalAmount * gstPercent / 100).toFixed(2));
    const grandTotal = Number((totalAmount + gstAmount).toFixed(2));

    return `

        <div class="a4-summary">

            <div class="a4-summary-box">
                <small>Total Milk</small>
                <strong>${Number(totalLitres || 0).toFixed(2)} L</strong>
            </div>

            <div class="a4-summary-box">
                <small>GST (${gstPercent.toFixed(2)}%)</small>
                <strong>${money(gstAmount)}</strong>
            </div>

            <div class="a4-summary-box">
                <small>Total Paid</small>
                <strong>${money(totalPaid)}</strong>
            </div>

        </div>

        ${
            statementPayments.length
                ? `
                    <div class="a4-history">

                        <h4>Payment History</h4>

                        <table>

                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Note</th>
                                </tr>
                            </thead>

                            <tbody>

                                ${statementPayments.map(p=>`

                                    <tr>

                                        <td>
                                            ${formatDate(p.date)}
                                        </td>

                                        <td>
                                            ${escapeHTML(p.type)}
                                        </td>

                                        <td>
                                            ${money(p.amount)}
                                        </td>

                                        <td>
                                            ${escapeHTML(p.method || "-")}
                                        </td>

                                        <td>
                                            ${escapeHTML(p.note || "-")}
                                        </td>

                                    </tr>

                                `).join("")}

                            </tbody>

                        </table>

                    </div>
                  `
                : ""
        }

    `;
}

function printStatement(){

    const data =
        getStatementData();

    if(!data){

        showToast(
            "Select a customer and valid date range.",
            true
        );

        return;
    }

    generateStatementPreview();

    setTimeout(()=>{
        window.print();
    },100);

}

/* =========================================================
   PDF
========================================================= */

function ensurePDF(){

    if(
        !window.jspdf ||
        typeof window.jspdf.jsPDF !== "function"
    ){

        showToast(
            "PDF library is unavailable. Use Print / Save PDF.",
            true
        );

        return false;
    }

    return true;
}

/* Hands control back to the browser between heavy synchronous chunks of
   work (e.g. each page of a multi-page PDF export) so long exports never
   look like a hung/infinite loop to the page or to any watchdog. */
function yieldToBrowser(){
    return new Promise(resolve=>{
        if(typeof requestAnimationFrame === "function"){
            requestAnimationFrame(()=>setTimeout(resolve,0));
        }else{
            setTimeout(resolve,0);
        }
    });
}

/* FIX (recurring watchdog timeout, this time keeping pixel-perfect output):
   The user needs the downloaded PDF to look EXACTLY like the on-screen
   website preview (same watermark, logo, fonts, spacing, ₹ symbol) — a
   jsPDF/AutoTable text-rebuild can never match that exactly since it is a
   totally separate rendering engine. So we go back to capturing the real
   HTML preview with html2canvas, but this time captured and encoded in
   small ROW-SIZED STRIPS instead of one giant canvas.

   Why this avoids the watchdog: the earlier failures always came from a
   SINGLE synchronous call — either one big html2canvas capture, or one
   canvas.toDataURL() JPEG encode — that by itself took longer than 400ms
   and could not be interrupted mid-call. By capturing the page in short,
   fixed-height strips (one small html2canvas call per strip, each strip
   individually encoded), no single synchronous operation is ever large
   enough to cross the 400ms limit, and we yield to the browser between
   every strip. The final PDF is assembled strip-by-strip onto A4 pages,
   so the visual result is identical to capturing the whole page at once. */
async function downloadCustomerPDF(){

    const data = getStatementData();

    if(!data){
        showToast("Select a customer and valid date range.",true);
        return;
    }

    if(!ensurePDF()) return;

    if(typeof window.html2canvas !== "function"){
        showToast("PDF renderer is unavailable. Please check your internet connection.",true);
        return;
    }

    const preview = document.getElementById("statementPreview");
    const page = preview?.querySelector(".a4");

    if(!page){
        showToast("Generate the invoice preview first.",true);
        return;
    }

    const oldWidth = page.style.width;
    const oldMaxWidth = page.style.maxWidth;
    const oldMargin = page.style.margin;

    page.style.width = "794px";
    page.style.maxWidth = "794px";
    page.style.margin = "0 auto";

    showToast("Preparing PDF that matches the preview...");

    /* Wait for logo + watermark images to finish loading, so the strips
       capture them exactly as shown on screen. */
    const invoiceImages = Array.from(page.querySelectorAll("img"));
    await Promise.all(invoiceImages.map(img=>{
        if(img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve=>{
            const done = ()=>{
                img.removeEventListener("load",done);
                img.removeEventListener("error",done);
                resolve();
            };
            img.addEventListener("load",done,{once:true});
            img.addEventListener("error",done,{once:true});
        });
    }));

    /* Let layout settle at the fixed 794px width before measuring height. */
    await yieldToBrowser();

    try{

        const SCALE = 3; // Increased scale for better quality
        const CSS_STRIP_HEIGHT = 200; // Reduced strip height for finer processing
        const totalCssHeight = page.scrollHeight;
        const stripCount = Math.max(1, Math.ceil(totalCssHeight / CSS_STRIP_HEIGHT));
        const MAX_STRIPS = 80; // Adjusted for new strip height

        if(stripCount > MAX_STRIPS){
            throw new Error("Statement is too long to export safely.");
        }

        const {jsPDF} = window.jspdf;
        const pdf = new jsPDF({
            orientation:"portrait",
            unit:"mm",
            format:"a4",
            compress: false // Disable compression for better quality
        });

        const pdfPageWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const mmPerCssPx = pdfPageWidth / 794;

        let cursorMm = 0; // where on the current PDF page (in mm) we are
        let pageStarted = false;

        for(let strip=0; strip<stripCount; strip++){

            const stripY = strip * CSS_STRIP_HEIGHT;
            const stripHeight = Math.min(
                CSS_STRIP_HEIGHT,
                totalCssHeight - stripY
            );

            if(stripHeight <= 0) break;

            // Capture ONLY this small strip of the page
            const stripCanvas = await html2canvas(page,{
                scale:SCALE,
                useCORS:true,
                allowTaint:false,
                backgroundColor:"#FFFFFF",
                logging:false,
                imageTimeout:15000, // Increased timeout
                windowWidth:794,
                scrollX:0,
                scrollY:0,
                x:0,
                y:stripY,
                width:794,
                height:stripHeight
            });

            await yieldToBrowser();

            // Use higher quality PNG instead of JPEG
            const stripDataUrl = stripCanvas.toDataURL("image/png");

            await yieldToBrowser();

            const stripHeightMm = stripHeight * mmPerCssPx;

            // Start a new PDF page when needed
            if(!pageStarted || cursorMm + stripHeightMm > pdfPageHeight){
                if(pageStarted) pdf.addPage();
                pageStarted = true;
                cursorMm = 0;
            }

            pdf.addImage(
                stripDataUrl,
                "PNG", // Changed to PNG for better quality
                0,
                cursorMm,
                pdfPageWidth,
                stripHeightMm,
                undefined,
                "NONE" // No compression for better quality
            );

            cursorMm += stripHeightMm;

            // Yield more frequently to prevent blocking
            if (strip % 3 === 0) {
                await yieldToBrowser();
            }
        }

        page.style.width = oldWidth;
        page.style.maxWidth = oldMaxWidth;
        page.style.margin = oldMargin;

        const safeName = String(data.customer.name || "Customer")
            .replace(/[^a-z0-9]/gi,"-")
            .replace(/-+/g,"-")
            .replace(/^-|-$/g,"")
            .slice(0,50) || "Customer";

        pdf.save(`Vijayalakshmi-${safeName}-Statement.pdf`);
        showToast("PDF downloaded — matches the preview exactly.");

    }catch(error){

        page.style.width = oldWidth;
        page.style.maxWidth = oldMaxWidth;
        page.style.margin = oldMargin;

        console.error("PDF rendering failed:",error);
        showToast("Could not create PDF. Please try again.",true);
    }
}

function downloadTodayPDF(){

    const rows =
        milk
            .filter(m=>m.date===today())
            .sort((a,b)=>
                customerName(a.customerId)
                    .localeCompare(
                        customerName(b.customerId)
                    )
            );

    if(!rows.length){

        showToast(
            "No collection records for today.",
            true
        );

        return;
    }

    if(!ensurePDF()) return;

    const {jsPDF} = window.jspdf;

    const doc =
        new jsPDF({
            orientation:"portrait",
            unit:"mm",
            format:"a4"
        });

    if(typeof doc.autoTable !== "function"){

        showToast(
            "PDF table plugin unavailable.",
            true
        );

        return;
    }

    const columns = [
        "Customer",
        "Litres"
    ];

    if(settings.showFat){
        columns.push("FAT %");
    }

    if(settings.showSnf){
        columns.push("SNF %");
    }

    columns.push(
        "Rate/L",
        "Amount"
    );

    const body =
        rows.map(m=>{

            const row = [
                customerName(m.customerId),
                Number(m.litres||0).toFixed(2)
            ];

            if(settings.showFat){
                row.push(
                    Number(m.fat||0).toFixed(2)
                );
            }

            if(settings.showSnf){
                row.push(
                    Number(m.snf||0).toFixed(2)
                );
            }

            row.push(
                "Rs. " + Number(m.rate||0).toFixed(2),
                "Rs. " + entryAmount(m).toFixed(2)
            );

            return row;

        });

    const totalLitres =
        rows.reduce(
            (sum,m)=>sum+Number(m.litres||0),
            0
        );

    const totalAmount =
        rows.reduce(
            (sum,m)=>sum+entryAmount(m),
            0
        );

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Premium branded header
    doc.setFillColor(8,127,91);
    doc.roundedRect(10,10,pageWidth-20,25,4,4,"F");

    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(14);
    doc.text(settings.businessName || "Vijayalakshmi Milk Products",20,20);

    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.text("TODAY'S MORNING MILK COLLECTION",20,26);
    doc.setFont("helvetica","bold");
    doc.setFontSize(8);
    doc.text(formatDate(today()),pageWidth-16,20,{align:"right"});
    doc.setFont("helvetica","normal");
    doc.setFontSize(7);
    doc.text("Daily report",pageWidth-16,26,{align:"right"});

    doc.autoTable({

        startY:43,

        head:[columns],

        body,

        theme:"grid",

        styles:{
            font:"helvetica",
            fontSize:7.5,
            cellPadding:3.5,
            textColor:[55,65,81],
            lineColor:[226,234,229],
            lineWidth:.15
        },

        alternateRowStyles:{
            fillColor:[249,252,250]
        },

        headStyles:{
            fillColor:[8,127,91],
            textColor:[255,255,255],
            fontStyle:"bold",
            lineColor:[8,127,91],
            lineWidth:.2
        },

        columnStyles:{
            [columns.length-1]:{
                halign:"right"
            },
            [columns.length-2]:{
                halign:"right"
            }
        },

        foot:[[
            {
                content:"Total",
                colSpan:columns.length-1,
                styles:{fontStyle:"bold"}
            },
            "Rs. "+totalAmount.toFixed(2)
        ]],

        footStyles:{
            textColor:[23,33,29],
            fontStyle:"bold",
            lineColor:[23,33,29],
            lineWidth:.3
        }

    });

    const y =
        doc.lastAutoTable.finalY + 10;

    doc.setDrawColor(220,227,223);

    doc.line(15,y,195,y);

    doc.setFont("helvetica","normal");
    doc.setFontSize(6.5);
    doc.setTextColor(150,160,155);

    doc.text("CUSTOMERS",15,y+8);
    doc.text("TOTAL MILK",90,y+8);
    doc.text("TOTAL VALUE",195,y+8,{align:"right"});

    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.setTextColor(23,33,29);

    doc.text(
        String(
            new Set(rows.map(r=>r.customerId)).size
        ),
        15,
        y+14
    );

    doc.text(
        totalLitres.toFixed(2)+" L",
        90,
        y+14
    );

    doc.text(
        "Rs. "+totalAmount.toFixed(2),
        195,
        y+14,
        {align:"right"}
    );

    doc.setDrawColor(220,227,223);
    doc.line(15,pageHeight-15,pageWidth-15,pageHeight-15);
    doc.setFont("helvetica","normal");
    doc.setFontSize(6.5);
    doc.setTextColor(150,160,155);
    doc.text(
        `${settings.businessName || "Vijayalakshmi Milk Products"} · Generated report`,
        15,
        pageHeight-9
    );
    doc.text("Page 1",pageWidth-15,pageHeight-9,{align:"right"});

    doc.save(
        `Vijayalakshmi-Todays-Collection-${today()}.pdf`
    );

    showToast("Today's collection PDF downloaded.");
}

/* =========================================================
   SETTINGS
========================================================= */

function updateToggleIcons(){

    ["showFat","showSnf","showAdvance"].forEach(id=>{

        const input = document.getElementById(id);
        const icon = input?.nextElementSibling;

        if(!input || !icon) return;

        icon.classList.toggle("is-on",input.checked);
        icon.classList.toggle("bi-toggle-on",input.checked);
        icon.classList.toggle("bi-toggle-off",!input.checked);

    });
}

function loadSettingsUI(){

    document.getElementById("businessName").value =
        settings.businessName;

    document.getElementById("businessAddress").value =
        settings.businessAddress;

    document.getElementById("businessPhone").value =
        settings.businessPhone;

    document.getElementById("businessGst").value =
        settings.businessGstPercent || "";

    document.getElementById("showFat").checked =
        settings.showFat;

    document.getElementById("showSnf").checked =
        settings.showSnf;

    document.getElementById("showAdvance").checked =
        settings.showAdvance;

    updateToggleIcons();
    renderLogoPreview();
}

function renderLogoPreview(){
    const sideName = document.getElementById("sideBusinessName");
    const mobileName = document.getElementById("mobileBusinessName");
    const preview = document.getElementById("logoPreview");

    if(sideName){
        sideName.textContent = settings.businessName
            .replace(/\s+Milk Products$/i,"")
            .slice(0,30) || "Vijayalakshmi";
    }
    if(mobileName){
        mobileName.textContent = settings.businessName.slice(0,30);
    }

    if(preview){
        preview.innerHTML = settings.businessLogo
            ? `<img src="${escapeAttr(settings.businessLogo)}" alt="Business logo">`
            : `<i class="bi bi-image"></i>`;
    }
}

/* =========================================================
   LOGO UPLOAD
========================================================= */

const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB, keeps localStorage usage sane

function handleLogoUpload(event){

    const file = event.target.files && event.target.files[0];

    if(!file){
        return;
    }

    if(!/^image\/(png|jpe?g|webp)$/i.test(file.type)){
        showToast("Logo must be a PNG, JPG or WEBP image.",true);
        event.target.value = "";
        return;
    }

    if(file.size > MAX_LOGO_BYTES){
        showToast("Logo image is too large. Please use a file under 1 MB.",true);
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = ()=>{

        /* SECURITY FIX: verify the FileReader output is actually a well
           formed image data URL before trusting it (defense in depth —
           the browser's own MIME sniffing during decode should already
           reject anything else, but this keeps a bad value from ever
           reaching localStorage or an <img src>). */
        if(!isSafeLogoDataUrl(reader.result)){
            showToast("Could not read the selected image.",true);
            event.target.value = "";
            return;
        }

        settings = {
            ...settings,
            businessLogo:reader.result
        };

            renderLogoPreview();
    generateStatementPreview();
    showToast("Logo updated.");

        event.target.value = "";
    };

    reader.onerror = ()=>{
        showToast("Could not read the selected image.",true);
        event.target.value = "";
    };

    reader.readAsDataURL(file);
}

function removeLogo(){

    if(!settings.businessLogo){
        return;
    }

    settings = {
        ...settings,
        businessLogo:""
    };

    renderLogoPreview();
    generateStatementPreview();
    showToast("Logo removed.");
}

function saveSettings(){

    const businessName =
        document
            .getElementById("businessName")
            .value
            .trim();

    const businessAddress =
        document
            .getElementById("businessAddress")
            .value
            .trim();

    const businessPhone =
        document
            .getElementById("businessPhone")
            .value
            .trim();

    const businessGstPercent =
        safeNumber(
            document.getElementById("businessGst").value,
            0,
            100
        );

    if(businessPhone &&
       !/^\d{10}$/.test(businessPhone)){

        showToast(
            "Business phone must contain 10 digits.",
            true
        );

        return;
    }

    if(document.getElementById("businessGst").value.trim() &&
       businessGstPercent === null){

        showToast(
            "GST % must be a number between 0 and 100.",
            true
        );

        return;
    }

    settings = {

        ...settings,

        businessName:
            businessName.slice(0,120) ||
            DEFAULT_SETTINGS.businessName,

        businessAddress:
            businessAddress.slice(0,250),

        businessPhone:
            businessPhone.slice(0,20),

        businessGstPercent:
            businessGstPercent ?? 0,

        showFat:
            document.getElementById("showFat").checked,

        showSnf:
            document.getElementById("showSnf").checked,

        showAdvance:
            document.getElementById("showAdvance").checked

    };

    updateToggleIcons();

    renderMilk();
    generateStatementPreview();
    showToast("Settings saved.");
}

/* =========================================================
   BACKUP (EXCEL EXPORT)
   Restore/Import, Demo Data and Reset All Data have been removed
   per request. Backups are now exported as a multi-sheet Excel
   workbook (via SheetJS) for easy viewing/record-keeping rather
   than as a machine-readable JSON file for re-import.
========================================================= */

function exportData(){

    if(typeof window.XLSX === "undefined"){
        showToast("Excel export is unavailable. Please check your internet connection.",true);
        return;
    }

    try{

        const customerSheet = customers.map(c=>({
            "Customer ID":c.id,
            "Name":c.name,
            "Phone":c.phone,
            "Place":c.place,
            "Start Date":c.startDate
        }));

        const milkSheet = milk
            .slice()
            .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
            .map(m=>({
                "Date":m.date,
                "Customer":customerName(m.customerId),
                "Litres":Number(m.litres||0),
                "FAT %":Number(m.fat||0),
                "SNF %":Number(m.snf||0),
                "Rate/L":Number(m.rate||0),
                "Amount":entryAmount(m)
            }));

        const paymentSheet = payments
            .slice()
            .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
            .map(p=>({
                "Date":p.date,
                "Customer":customerName(p.customerId),
                "Type":p.type,
                "Amount":Number(p.amount||0),
                "Method":p.method || "",
                "Note":p.note || ""
            }));

        const summarySheet = customers.map(c=>{
            const f = getCustomerFinancials(c.id);
            return {
                "Customer":c.name,
                "Phone":c.phone,
                "Milk Entries":f.milkCount,
                "Milk Amount":f.milkAmount,
                "Payments Received":f.paidAmount,
                "Balance":f.balance
            };
        });

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(customerSheet),
            "Customers"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(milkSheet),
            "Milk Collection"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(paymentSheet),
            "Payments"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.json_to_sheet(summarySheet),
            "Balance Summary"
        );

        XLSX.writeFile(
            workbook,
            `vijayalakshmi-backup-${today()}.xlsx`
        );

        showToast("Backup downloaded as Excel file.");

    }catch(error){

        console.error(error);

        showToast(
            "Could not create Excel backup.",
            true
        );
    }
}


/* =========================================================
   NORMALIZE EXISTING DATA
========================================================= */

function normalizeExistingData(){

    customers =
        customers
            .filter(c=>
                c &&
                typeof c === "object" &&
                typeof c.id === "string" &&
                typeof c.name === "string" &&
                c.name.trim()
            )
            .map(c=>({

                ...c,

                name:c.name
                    .trim()
                    .slice(0,80),

                phone:
                    typeof c.phone === "string"
                        ? c.phone.replace(/\D/g,"").slice(0,10)
                        : "",

                place:
                    typeof c.place === "string"
                        ? c.place.slice(0,80)
                        : "",

                startDate:
                    isISODate(c.startDate) &&
                    c.startDate <= today()
                        ? c.startDate
                        : today()

            }));

    /* FIX (bug #11): detect and repair corrupted duplicate customer IDs
       (e.g. from manual localStorage tampering or a bad merge) instead of
       silently letting two different customers collide under one id,
       which would corrupt every milk/payment lookup keyed by that id. */
    {
        const seenIds = new Set();

        customers = customers.map(c=>{

            if(!seenIds.has(c.id)){
                seenIds.add(c.id);
                return c;
            }

            let newId = uid("customer");
            while(seenIds.has(newId)){
                newId = uid("customer");
            }
            seenIds.add(newId);

            console.warn(
                `Duplicate customer id "${c.id}" found and reassigned to "${newId}".`
            );

            return {...c,id:newId};

        });
    }

    const customerIds =
        new Set(customers.map(c=>c.id));

    const seenMilk =
        new Set();

    /* FIX (bug #13): previously a duplicate milk record (same customer +
       same date) was silently dropped with no trace. Now we warn in the
       console (and surface a one-time toast) so data loss is visible
       instead of invisible, while still keeping only one record per
       customer per day. */
    let duplicateMilkDropped = 0;

    milk =
        milk
            .filter(m=>
                m &&
                typeof m === "object" &&
                typeof m.id === "string" &&
                customerIds.has(m.customerId) &&
                isISODate(m.date) &&
                m.date <= today()
            )
            .map(m=>({

                ...m,

                litres:
                    safeNumber(m.litres,0.01,9999) || 0.01,

                rate:
                    safeNumber(m.rate,0.01,100000) || 0.01,

                fat:
                    safeNumber(m.fat,0,15) ?? 0,

                snf:
                    safeNumber(m.snf,0,15) ?? 0

            }))
            .filter(m=>{

                const key =
                    m.customerId+"|"+m.date;

                if(seenMilk.has(key)){
                    duplicateMilkDropped++;
                    console.warn(
                        `Duplicate milk record for customer ${m.customerId} on ${m.date} was removed (id: ${m.id}).`
                    );
                    return false;
                }

                seenMilk.add(key);

                return true;

            })
            .map(m=>({

                ...m,

                amount:Number(
                    (
                        Number(m.litres) *
                        Number(m.rate)
                    ).toFixed(2)
                )

            }));

    if(duplicateMilkDropped > 0){
        setTimeout(()=>{
            showToast(
                `${duplicateMilkDropped} duplicate milk record(s) were found and removed automatically.`,
                true
            );
        },500);
    }

    payments =
        payments
            .filter(p=>
                p &&
                typeof p === "object" &&
                typeof p.id === "string" &&
                customerIds.has(p.customerId) &&
                (p.type==="Advance" ||
                 p.type==="Payment") &&
                isISODate(p.date) &&
                p.date<=today()
            )
            .map(p=>({

                ...p,

                amount:
                    safeNumber(
                        p.amount,
                        0.01,
                        100000000
                    ) || 0.01,

                method:
                    typeof p.method==="string"
                        ? p.method.slice(0,40)
                        : "Cash",

                note:
                    typeof p.note==="string"
                        ? p.note.slice(0,250)
                        : ""

            }));

}

/* =========================================================
   UPDATE ALL
========================================================= */

function updateAll(){

    renderCustomers();

    renderMilk();

    renderPayments();

    updateDashboard();

    populateCustomerSelects();

    generateStatementPreview();


}

/* =========================================================
   INITIALIZATION
========================================================= */

function init(){

    normalizeExistingData();

    /* FIX (bug #4 — critical): seedSanjeevanDemoData() used to run on
       EVERY app load, silently injecting a fake "Sanjeevan" customer with
       15 days of fabricated milk history into a real user's data. This is
       a serious bug for a production app: a genuine shop owner would see
       a customer they never added. Demo seeding has been removed from the
       normal startup path entirely.

       If you ever want sample data for a fresh demo/test install, call
       seedDemoDataManually() yourself from the browser console — it will
       refuse to run if any real customer already exists. */
    // seedSanjeevanDemoData();  // <-- intentionally disabled, do not re-enable in init()

    normalizeExistingData();

    loadSettingsUI();

    populateCustomerSelects();

    document.getElementById("milkDate").max = today();
    document.getElementById("paymentDate").max = today();

    document.getElementById("statementStart").max = today();
    document.getElementById("statementEnd").max = today();

    updateAll();

    updateDashboardBanner();

    setInterval(updateDashboardBanner,60000);

}

/* =========================================================
   OPTIONAL DEMO DATA (manual only — never auto-run)
   Call seedDemoDataManually() from the browser console if you want to
   populate a fresh install with one sample customer + 15 days of milk
   history for demonstration purposes. It intentionally refuses to run
   once any real customer data exists, so it can never silently corrupt
   a real shop's data.
========================================================= */

function seedDemoDataManually(){

    if(customers.length > 0){
        console.warn("Demo data was NOT added: customers already exist.");
        showToast("Demo data skipped: customers already exist.",true);
        return;
    }

    const customerId = "customer_sanjeevan_demo";

    customers.push({
        id:customerId,
        name:"Sanjeevan",
        phone:"9876543210",
        place:"Main Road",
        startDate:addDaysToISO(today(),-14),
        createdAt:new Date().toISOString()
    });

    const rate = 45;

    for(let daysAgo=14; daysAgo>=0; daysAgo--){
        const date = addDaysToISO(today(),-daysAgo);
        const milkId = `milk_sanjeevan_demo_${date}`;
        const litres = Number((6 + ((14 - daysAgo) % 4) * 0.25).toFixed(2));

        milk.push({
            id:milkId,
            customerId,
            date,
            litres,
            fat:4.2,
            snf:8.5,
            rate,
            amount:Number((litres * rate).toFixed(2)),
            createdAt:new Date().toISOString()
        });
    }

    updateAll();
    showToast("Demo data added.");
}

/* Start application only after the Firestore PIN is verified. */
document.addEventListener("DOMContentLoaded",initializeLogin);
