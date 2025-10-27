Module.register("MMM-MealViewer", {
    defaults: {
        schoolId: "",
        updateInterval: 14400000,
        startDay: 0,
        endDay: 5,
        maxDisplayDays: null, // Set a number to limit displayed days, null for no limit
        showPastDays: false,
        hideTodayAfter: "14:00",
        showBreakfast: true,
        showLunch: true,
        testMode: false,
        testDate: null, // Format: "YYYY-MM-DD"
        filters: {
            breakfast: [],
            lunch: []
        },
        itemTypeFilters: {
            breakfast: [],
            lunch: []
        },
        exactNameFilters: {
            breakfast: [],
            lunch: []
        },
        startsWithFilters: {
            breakfast: [],
            lunch: []
        }
    },

    start: function () {
        this.mealData = null;
        this.schoolLogo = null;
        this.schoolName = null;
        this.hasMenus = false;
        this.identifier = this.identifier || Math.random().toString(36).substring(2, 15);
        this.getData();
        this.scheduleUpdate();
    },

    getData: function () {
        this.sendSocketNotification("GET_MEAL_DATA", {
            identifier: this.identifier,
            schoolId: this.config.schoolId,
            filters: this.config.filters,
            itemTypeFilters: this.config.itemTypeFilters,
            exactNameFilters: this.config.exactNameFilters,
            startsWithFilters: this.config.startsWithFilters,
            startDay: this.config.startDay,
            endDay: this.config.endDay,
            showPastDays: this.config.showPastDays,
            hideTodayAfter: this.config.hideTodayAfter,
            showBreakfast: this.config.showBreakfast,
            showLunch: this.config.showLunch,
            testMode: this.config.testMode,
            testDate: this.config.testDate
        });
    },

    scheduleUpdate: function () {
        setInterval(() => {
            this.getData();
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "MEAL_DATA" && payload.identifier === this.identifier) {
            this.mealData = payload.mealData;
            this.schoolLogo = payload.schoolLogo;
            this.schoolName = payload.schoolName;
            this.hasMenus = payload.hasMenus;
            this.updateDom();
        }
    },

    getDom: function () {
        var wrapper = document.createElement("div");
        wrapper.className = "meal-viewer";

        if (!this.mealData || this.mealData.length === 0) {
            // Return an empty wrapper if there's no data or no menus to show
            return wrapper;
        }

        var menu = document.createElement("div");

        const header = document.createElement("header");
        header.className = "module-header";

        if (this.schoolLogo) {
            const logo = document.createElement("img");
            logo.src = this.schoolLogo;
            logo.className = "school-logo";
            header.appendChild(logo);
        }

        const title = document.createElement("span");
        title.textContent = this.schoolName ? `${this.schoolName} Menu` : "School Menu";
        header.appendChild(title);

        menu.appendChild(header);

        const contentWrapper = document.createElement("div");
        contentWrapper.className = "module-content";

        let hasContent = false;
        let daysShown = 0;

        // Filter to show only maxDisplayDays if set
        const displayData = this.config.maxDisplayDays 
            ? this.mealData.slice(0, this.config.maxDisplayDays) 
            : this.mealData;

        displayData.forEach(day => {
            const hasBreakfast = day.breakfast && day.breakfast.trim() !== "";
            const hasLunch = day.lunch && day.lunch.trim() !== "";

            // Only create day menu if there's data to show
            if ((this.config.showBreakfast && hasBreakfast) || (this.config.showLunch && hasLunch)) {
                hasContent = true;
                var dayMenu = document.createElement("div");
                dayMenu.className = "day-menu";

                var dateElem = document.createElement("div");
                dateElem.className = "day-header";
                dateElem.textContent = day.date.toUpperCase();
                dayMenu.appendChild(dateElem);

                if (this.config.showBreakfast && hasBreakfast) {
                    var breakfastElem = document.createElement("div");
                    breakfastElem.className = "meal-line";
                    breakfastElem.innerHTML = `<span class="meal-type">Breakfast:</span> ${day.breakfast}`;
                    dayMenu.appendChild(breakfastElem);
                }

                if (this.config.showLunch && hasLunch) {
                    var lunchElem = document.createElement("div");
                    lunchElem.className = "meal-line";
                    lunchElem.innerHTML = `<span class="meal-type">Lunch:</span> ${day.lunch}`;
                    dayMenu.appendChild(lunchElem);
                }

                contentWrapper.appendChild(dayMenu);
            }
        });

        if (hasContent) {
            menu.appendChild(contentWrapper);
            wrapper.appendChild(menu);
        }

        return wrapper;
    },

    getStyles: function () {
        return ["MMM-MealViewer.css"];
    }
});