class CustomSelect {
	placeholder = 'Select an option';

  constructor(selectElement) {
    this.selectElement = selectElement;
    this.selectSelected = selectElement.querySelector(".select-selected");
		this.selectOptionsContainer = selectElement.querySelector('.select-options');
    this.selectOptions = selectElement.querySelectorAll(".select-option");

    this.init();
  }

  init() {
		this.selectSelected.innerText = this.placeholder;

    this.selectElement.addEventListener("click", () => {
			this.toggle();
    });

		document.addEventListener("click", (event) => {
      if (!this.selectElement.contains(event.target)) {
        this.close();
      }
    });
  }

	addOption(value, label) {
    const newOption = document.createElement("div");
    newOption.classList.add("select-option");
    newOption.dataset.value = value;
    newOption.innerHTML = label;
		newOption.addEventListener("click", (event) => {
			event.stopPropagation();
			this.selectSelected.innerText = label;
			this.selectSelected.dataset.value = value;
			this.close();
		});
    this.selectOptionsContainer.appendChild(newOption);
    this.selectOptions = this.selectElement.querySelectorAll(".select-option");

		if(this.selectElement.hasAttribute('disabled')) this.selectElement.removeAttribute('disabled');
  }

	clearOptions() {
		this.selectSelected.innerText = this.placeholder;
    this.selectOptionsContainer.innerHTML = "";
  }

	toggle() {
		this.selectElement.classList.toggle("select--active");
	}

	close() {
		this.selectElement.classList.remove("select--active");
	}

	disable() {
		this.selectElement.setAttribute('disabled', '');
	}

	value() {
		return this.selectSelected.dataset.value;
	}
}